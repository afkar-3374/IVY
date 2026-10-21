import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import { generateLocalUuid } from '../utils/message';
import { USER_1_ID } from '../utils/constants';
import { seal, open, DECRYPT_FAILED } from './crypto/coupleCrypto';

const FILE_PREFIX = 'encf1:';
/** Big encrypted files waiting to be downloaded (local_uuid → ciphertext ref) */
const pendingFiles = new Map<string, string>();
let fileWorkerRunning = false;

/** Download and decrypt big files one at a time, then tell the chat to refresh. */
async function drainPendingFiles(): Promise<void> {
  if (fileWorkerRunning) return;
  fileWorkerRunning = true;
  try {
    while (pendingFiles.size > 0) {
      const [localUuid, cipher] = pendingFiles.entries().next().value as [string, string];
      pendingFiles.delete(localUuid);
      const content = await open(cipher);
      const local = await ivyDb.messages.get(localUuid);
      if (local && local.cipher !== cipher) {
        local.content = content;
        local.cipher = content === DECRYPT_FAILED ? undefined : cipher;
        await ivyDb.messages.put(local);
        window.dispatchEvent(new CustomEvent('ivy:message-content', { detail: { localUuid, content } }));
      }
    }
  } finally {
    fileWorkerRunning = false;
  }
}
import type { Message, UserProfile, MessageReaction, MessageType } from '../types';
import { ivyDb } from '../db/ivyDb';
import { syncQueue } from './sync/syncQueue';
import { queueProcessor } from './sync/queueProcessor';
import { networkMonitor } from './sync/networkMonitor';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveReplyReferences(msgs: Message[]): Message[] {
  const map = new Map<string, Message>();
  msgs.forEach((m) => {
    map.set(m.local_uuid, m);
    if (m.id) map.set(m.id, m);
  });

  return msgs.map((m) => {
    if (m.reply_to) {
      const referenced = map.get(m.reply_to);
      if (referenced) {
        const senderName = referenced.sender_id === USER_1_ID ? 'Afkar' : 'Princess';
        const displayContent = referenced.deleted ? 'This message was deleted.' : referenced.content;
        return {
          ...m,
          reply_to_msg: {
            id: referenced.local_uuid,
            sender_name: senderName,
            content: displayContent,
            message_type: referenced.message_type || 'text',
          },
        };
      } else if (!m.reply_to_msg) {
        return {
          ...m,
          reply_to_msg: {
            id: m.reply_to,
            sender_name: 'Message',
            content: 'Original message',
            message_type: 'text',
          },
        };
      }
    }
    return m;
  });
}


/** True when a stored message already matches what the server returned. */
function sameStored(a: Message, b: Message): boolean {
  return a.cipher === b.cipher && a.id === b.id && a.status === b.status && a.edited === b.edited &&
    a.deleted === b.deleted && a.pinned === b.pinned && a.starred === b.starred && a.message_type === b.message_type &&
    a.delivered_at === b.delivered_at && a.read_at === b.read_at;
}

/** Decrypt the private fields of a profile row. */
async function openProfile(row: UserProfile): Promise<UserProfile> {
  return {
    ...row,
    nickname: await open(row.nickname || ''),
    about: await open(row.about || ''),
    avatar_url: await open(row.avatar_url || ''),
    mood: await open(row.mood || ''),
  };
}

/**
 * Convert a server row into a local message, decrypting its content.
 * Decryption is skipped when the ciphertext matches what is already cached locally.
 */
async function toLocalMessage(item: any, existingLocal?: Message): Promise<Message> {
  const localUuid = item.local_uuid || item.id;
  let content: string;
  if (existingLocal && existingLocal.cipher === item.content) {
    content = existingLocal.content;
  } else if (typeof item.content === 'string' && item.content.startsWith(FILE_PREFIX)) {
    // Big files download in the background so they never hold up the chat
    content = '';
    pendingFiles.set(localUuid, item.content);
    void drainPendingFiles();
  } else {
    content = await open(item.content);
  }
  const isAudioData = content.startsWith('data:audio/');
  const resolvedType: MessageType = isAudioData ? 'voice' : (item.message_type || 'text');

  let status: Message['status'] = 'Sent';
  if (item.status === 'read' || item.status === 'Read') status = 'Read';
  else if (item.status === 'delivered' || item.status === 'Delivered') status = 'Delivered';

  return {
    id: item.id,
    local_uuid: localUuid,
    sender_id: item.sender_id,
    receiver_id: item.receiver_id || '',
    content,
    // Remember the ciphertext only once decrypted, so failures (and pending files) are retried later
    cipher: content === DECRYPT_FAILED || content === '' ? undefined : item.content,
    message_type: resolvedType,
    reply_to: item.reply_to,
    edited: item.edited || false,
    edited_at: item.edited_at,
    deleted: item.deleted || false,
    deleted_at: item.deleted_at,
    pinned: item.pinned || false,
    starred: item.starred || false,
    forwarded: item.forwarded || false,
    status,
    delivered_at: item.delivered_at || undefined,
    read_at: item.read_at || undefined,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at || item.created_at || new Date().toISOString(),
    reactions: [],
  };
}

/** Partner messages this device has received but not yet reported as delivered. */
const toConfirm = new Set<string>();
const confirmed = new Set<string>();
let confirmTimer: number | null = null;

/** Tell the sender (two grey ticks) that their messages reached this device. Never downgrades "read". */
function confirmDelivered(items: Array<{ local_uuid?: string; id: string; sender_id: string; status?: string }>, myId: string | undefined) {
  if (!myId || !supabase) return;
  for (const item of items) {
    const key = item.local_uuid || item.id;
    if (item.sender_id !== myId && (item.status === 'sent' || item.status === 'Sent') && !confirmed.has(key)) {
      toConfirm.add(key);
      confirmed.add(key);
    }
  }
  if (toConfirm.size === 0 || confirmTimer !== null) return;
  confirmTimer = window.setTimeout(async () => {
    confirmTimer = null;
    const uuids = [...toConfirm];
    toConfirm.clear();
    const { error } = await supabase!.from('messages').update({ status: 'delivered' }).in('local_uuid', uuids).eq('status', 'sent');
    if (error) {
      logger.warn('Unable to confirm delivery:', error.message);
      uuids.forEach((u) => {
        confirmed.delete(u);
        toConfirm.add(u);
      });
    }
  }, 300);
}

async function myUserId(): Promise<string | undefined> {
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

export class ChatService {
  private realtimeUnsubscribe: (() => void) | null = null;
  /**
   * Fetch both partner profiles from Supabase (decrypted), falling back to the local cache.
   */
  async getProfiles(): Promise<UserProfile[]> {
    if (supabase && networkMonitor.isOnline()) {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data) {
          const profiles = await Promise.all(data.map((row) => openProfile(row as UserProfile)));
          await ivyDb.profiles.bulkPut(profiles);
          return profiles;
        }
        if (error) logger.error('Supabase profiles query error:', error.message);
      } catch (err) {
        logger.error('Supabase profiles query error:', err);
      }
    }
    return ivyDb.profiles.toArray();
  }

  /**
   * Save own profile: private fields are encrypted before leaving the device.
   */
  async updateProfile(profile: UserProfile): Promise<void> {
    profile.updated_at = new Date().toISOString();
    try {
      await ivyDb.profiles.put(profile);
      if (supabase && networkMonitor.isOnline()) {
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: profile.display_name,
            nickname: await seal(profile.nickname || ''),
            about: await seal(profile.about || ''),
            avatar_url: await seal(profile.avatar_url || ''),
            wallpaper: profile.wallpaper,
            theme: profile.theme,
            updated_at: profile.updated_at,
          })
          .eq('id', profile.id);
        if (error) logger.error('Error updating profile:', error.message);
      }
    } catch (err) {
      logger.error('Error updating profile:', err);
    }
  }

  subscribeToProfileChanges(onChange: () => void): () => void {
    if (!supabase) return () => {};
    const client = supabase;
    const channel = client
      .channel('ivy_profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => onChange())
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }

  /**
   * Fetch all messages. Loads from IndexedDB first, then fetches from Supabase if online,
   * merges/upserts into IndexedDB, and returns sorted messages with resolved reply references.
   */
  async getMessages(fetchRemote = true): Promise<Message[]> {
    try {
      // 1. Get cached local messages first
      const localMsgs = await ivyDb.messages.orderBy('created_at').toArray();
      const localReactions = await ivyDb.reactions.toArray();

      const attachReactions = (msgs: Message[], reactions: MessageReaction[]): Message[] => {
        const byMessageId = new Map<string, MessageReaction[]>();
        for (const reaction of reactions) {
          const entries = byMessageId.get(reaction.message_id) || [];
          entries.push(reaction);
          byMessageId.set(reaction.message_id, entries);
        }
        return msgs.map((m) => ({
          ...m,
          reactions: [...(byMessageId.get(m.local_uuid) || []), ...(m.id === m.local_uuid ? [] : byMessageId.get(m.id) || [])],
        }));
      };

      // 2. Fetch fresh data from Supabase if online
      if (fetchRemote && supabase && networkMonitor.isOnline()) {
        try {
          const [{ data: remoteMsgs }, { data: remoteReactions }] = await Promise.all([
            supabase.from('messages').select('*').order('created_at', { ascending: true }),
            supabase.from('message_reactions').select('*')
          ]);

          if (remoteMsgs && remoteMsgs.length > 0) {
            confirmDelivered(remoteMsgs, await myUserId());
            for (const item of remoteMsgs) {
              const existingLocal = await ivyDb.messages.get(item.local_uuid || item.id);
              const msg = await toLocalMessage(item, existingLocal);
              // Skip unchanged rows: rewriting every message on each load delays new sends
              if (!existingLocal || !sameStored(existingLocal, msg)) await ivyDb.messages.put(msg);
            }
          }

          if (remoteReactions) {
            await ivyDb.reactions.clear();
            for (const r of remoteReactions) {
              const reaction: MessageReaction = {
                id: r.id || generateLocalUuid(),
                message_id: r.message_id,
                profile_id: r.profile_id,
                emoji: r.emoji,
                created_at: r.created_at || new Date().toISOString()
              };
              await ivyDb.reactions.put(reaction);
            }
          }
        } catch (err) {
          logger.error('Background fetch from Supabase error:', err);
        }
      }

      // 3. Return updated array from IndexedDB with resolved replies
      const finalMsgs = await ivyDb.messages.orderBy('created_at').toArray();
      const finalReactions = await ivyDb.reactions.toArray();
      const msgsWithReactions = attachReactions(finalMsgs, finalReactions);
      return resolveReplyReferences(msgsWithReactions);
    } catch (err) {
      logger.error('Error fetching messages in ChatService:', err);
      return [];
    }
  }

  /**
   * Send message following Local-First flow:
   * Saves to IndexedDB immediately as Sending/Queued, adds to SyncQueue, triggers QueueProcessor.
   */
  async sendMessage(params: {
    sender_id: string;
    receiver_id: string;
    content: string;
    message_type?: MessageType;
    reply_to?: string;
    reply_to_msg?: Message['reply_to_msg'];
  }): Promise<Message> {
    const localUuid = generateLocalUuid();
    const now = new Date().toISOString();
    const isOnline = networkMonitor.isOnline();
    const initialStatus: Message['status'] = isOnline ? 'Sending' : 'Queued';

    const isAudioData = typeof params.content === 'string' && params.content.startsWith('data:audio/');
    const resolvedType: MessageType = isAudioData ? 'voice' : (params.message_type || 'text');

    const newMessage: Message = {
      id: localUuid,
      local_uuid: localUuid,
      sender_id: params.sender_id,
      receiver_id: params.receiver_id,
      content: params.content,
      message_type: resolvedType,
      reply_to: params.reply_to,
      reply_to_msg: params.reply_to_msg,
      edited: false,
      deleted: false,
      pinned: false,
      starred: false,
      forwarded: false,
      status: initialStatus,
      created_at: now,
      updated_at: now,
      reactions: []
    };

    // Save, queue and send in the background so the bubble appears instantly
    void (async () => {
      await ivyDb.messages.put(newMessage);
      await syncQueue.enqueue('SEND_MESSAGE', newMessage as unknown as Record<string, unknown>);
      queueProcessor.processQueue();
    })().catch((err) => logger.error('Unable to queue message:', err));

    return newMessage;
  }

  /**
   * Retry sending a failed message.
   */
  async retryFailedMessage(localUuid: string): Promise<void> {
    const msg = await ivyDb.messages.get(localUuid);
    if (!msg) return;

    msg.status = networkMonitor.isOnline() ? 'Sending' : 'Queued';
    await ivyDb.messages.put(msg);

    await syncQueue.enqueue('SEND_MESSAGE', msg as unknown as Record<string, unknown>);
    queueProcessor.processQueue();
  }

  /**
   * Edit message in IndexedDB and enqueue sync item.
   */
  async editMessage(localUuid: string, newContent: string): Promise<void> {
    const now = new Date().toISOString();
    const local = await ivyDb.messages.get(localUuid);
    if (local) {
      local.content = newContent;
      local.edited = true;
      local.edited_at = now;
      await ivyDb.messages.put(local);
    }

    await syncQueue.enqueue('EDIT_MESSAGE', { local_uuid: localUuid, content: newContent });
    queueProcessor.processQueue();
  }

  /**
   * Soft Delete Message in IndexedDB and enqueue sync item.
   */
  async deleteMessage(localUuid: string): Promise<void> {
    const now = new Date().toISOString();
    const local = await ivyDb.messages.get(localUuid);
    if (local) {
      local.deleted = true;
      local.deleted_at = now;
      local.content = 'This message was deleted.';
      await ivyDb.messages.put(local);
    }

    await syncQueue.enqueue('DELETE_MESSAGE', { local_uuid: localUuid });
    queueProcessor.processQueue();
  }

  /**
   * Toggle Pin Message.
   */
  async togglePin(localUuid: string): Promise<void> {
    const local = await ivyDb.messages.get(localUuid);
    if (local) {
      local.pinned = !local.pinned;
      await ivyDb.messages.put(local);
      await syncQueue.enqueue('PIN_MESSAGE', { local_uuid: localUuid, pinned: local.pinned });
      queueProcessor.processQueue();
    }
  }

  /**
   * Toggle Star Message.
   */
  async toggleStar(localUuid: string): Promise<void> {
    const local = await ivyDb.messages.get(localUuid);
    if (local) {
      local.starred = !local.starred;
      await ivyDb.messages.put(local);
      await syncQueue.enqueue('STAR_MESSAGE', { local_uuid: localUuid, starred: local.starred });
      queueProcessor.processQueue();
    }
  }

  /**
   * Toggle Reaction enforcing single reaction per user per message.
   */
  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const existing = await ivyDb.reactions
      .where('message_id')
      .equals(messageId)
      .and((r) => r.profile_id === userId)
      .first();

    if (existing) {
      if (existing.emoji === emoji) {
        // Same emoji -> remove reaction
        await ivyDb.reactions.delete(existing.id);
        await syncQueue.enqueue('REMOVE_REACTION', { message_id: messageId, profile_id: userId, emoji });
      } else {
        // Different emoji -> replace reaction
        await ivyDb.reactions.delete(existing.id);
        await syncQueue.enqueue('REMOVE_REACTION', { message_id: messageId, profile_id: userId, emoji: existing.emoji });

        const newReaction: MessageReaction = {
          id: generateLocalUuid(),
          message_id: messageId,
          profile_id: userId,
          emoji,
          created_at: new Date().toISOString()
        };
        await ivyDb.reactions.put(newReaction);
        await syncQueue.enqueue('ADD_REACTION', { message_id: messageId, profile_id: userId, emoji });
      }
    } else {
      const newReaction: MessageReaction = {
        id: generateLocalUuid(),
        message_id: messageId,
        profile_id: userId,
        emoji,
        created_at: new Date().toISOString()
      };
      await ivyDb.reactions.put(newReaction);
      await syncQueue.enqueue('ADD_REACTION', { message_id: messageId, profile_id: userId, emoji });
    }
    queueProcessor.processQueue();
  }

  /**
   * Mark received messages as read by current user.
   */
  async markMessagesAsRead(partnerId: string, currentUserId: string): Promise<void> {
    const unreadMsgs = await ivyDb.messages
      .where('sender_id')
      .equals(partnerId)
      .and((m) => m.receiver_id === currentUserId && m.status !== 'Read')
      .toArray();

    if (unreadMsgs.length === 0) return;

    const uuids: string[] = [];
    for (const msg of unreadMsgs) {
      msg.status = 'Read';
      await ivyDb.messages.put(msg);
      uuids.push(msg.local_uuid);
    }

    await syncQueue.enqueue('MARK_READ', { message_uuids: uuids });
    queueProcessor.processQueue();
  }

  /**
   * Subscribe directly to Supabase Realtime channel for messages & reactions.
   */
  subscribeToRealtimeMessages(
    onMessageReceived: (msg: Message) => void,
    onReactionsChanged: (msgs: Message[]) => void,
    /** Called whenever we may have missed events (connected, reconnected, app resumed) */
    onResync: () => void
  ): () => void {
    this.realtimeUnsubscribe?.();
    if (!supabase) return () => {};
    let retryTimer: number | null = null;
    let resyncTimer: number | null = null;
    const resyncSoon = () => {
      if (resyncTimer !== null) return;
      resyncTimer = window.setTimeout(() => {
        resyncTimer = null;
        onResync();
      }, 600);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') resyncSoon();
    };
    window.addEventListener('online', resyncSoon);
    document.addEventListener('visibilitychange', onVisible);

    const channel = supabase
      .channel('public:messages_and_reactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        async (payload) => {
          logger.info('Supabase Realtime message event:', payload.eventType, payload.new);
          if (payload.eventType === 'DELETE') {
            const oldItem = payload.old as { local_uuid?: string; id?: string };
            const localUuid = oldItem.local_uuid || oldItem.id;
            if (localUuid) await ivyDb.messages.delete(localUuid);
            return;
          }
          const item = payload.new as any;
          if (item && item.content) {
            if (payload.eventType === 'INSERT') confirmDelivered([item], await myUserId());
            const localUuid = item.local_uuid || item.id;
            const existingLocal = await ivyDb.messages.get(localUuid);
            const msg = await toLocalMessage(item, existingLocal);

            await ivyDb.messages.put(msg);
            const msgs = await this.getMessages(false);
            const resolvedMsg = msgs.find((m) => m.local_uuid === localUuid || m.id === item.id) || msg;
            onMessageReceived(resolvedMsg);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        async () => {
          onReactionsChanged(await this.getMessages());
        }
      )
      .subscribe((status, err) => {
        logger.info('Messages channel status:', status, err?.message || '');
        if (status === 'SUBSCRIBED') {
          // Anything sent while we were connecting never arrived as an event
          resyncSoon();
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && retryTimer === null) {
          retryTimer = window.setTimeout(() => {
            if (this.realtimeUnsubscribe === unsubscribe) {
              this.subscribeToRealtimeMessages(onMessageReceived, onReactionsChanged, onResync);
            }
          }, 2000);
        }
      });

    const unsubscribe = () => {
      window.removeEventListener('online', resyncSoon);
      document.removeEventListener('visibilitychange', onVisible);
      if (retryTimer !== null) clearTimeout(retryTimer);
      if (resyncTimer !== null) clearTimeout(resyncTimer);
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
      if (this.realtimeUnsubscribe === unsubscribe) this.realtimeUnsubscribe = null;
    };
    this.realtimeUnsubscribe = unsubscribe;
    return unsubscribe;
  }

  unsubscribeRealtimeMessages(): void {
    this.realtimeUnsubscribe?.();
  }
}

export const chatService = new ChatService();
