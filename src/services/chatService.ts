import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import { generateLocalUuid } from '../utils/message';
import { DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE, USER_1_ID } from '../utils/constants';
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

export class ChatService {
  private realtimeUnsubscribe: (() => void) | null = null;
  /**
   * Seed default predefined users directly into IndexedDB and Supabase profiles table.
   */
  async initPreseededProfiles(): Promise<void> {
    try {
      await ivyDb.profiles.bulkPut([DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE]);
      if (supabase && networkMonitor.isOnline()) {
        await supabase.from('profiles').upsert([DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE], { onConflict: 'id' });
      }
    } catch (err) {
      logger.error('Error seeding profiles:', err);
    }
  }

  /**
   * Fetch profile by login ID hash. Checks IndexedDB first, then Supabase.
   */
  async getProfileByHash(hash: string): Promise<UserProfile | null> {
    await this.initPreseededProfiles();

    try {
      const localProfile = await ivyDb.profiles.where('login_id_hash').equals(hash).first();
      if (localProfile) return localProfile;
    } catch (err) {
      logger.error('Local DB profile fetch error:', err);
    }

    if (supabase && networkMonitor.isOnline()) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('login_id_hash', hash)
          .single();

        if (!error && data) {
          const profile = data as UserProfile;
          await ivyDb.profiles.put(profile);
          return profile;
        }
      } catch (err) {
        logger.error('Supabase profile query error:', err);
      }
    }

    return null;
  }

  /**
   * Update User Profile directly in IndexedDB and Supabase.
   */
  async updateProfile(profile: UserProfile): Promise<void> {
    profile.updated_at = new Date().toISOString();
    try {
      await ivyDb.profiles.put(profile);
      if (supabase && networkMonitor.isOnline()) {
        await supabase.from('profiles').upsert(profile);
      }
    } catch (err) {
      logger.error('Error updating profile:', err);
    }
  }

  /**
   * Fetch all messages. Loads from IndexedDB first, then fetches from Supabase if online,
   * merges/upserts into IndexedDB, and returns sorted messages with resolved reply references.
   */
  async getMessages(): Promise<Message[]> {
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
      if (supabase && networkMonitor.isOnline()) {
        try {
          const [{ data: remoteMsgs }, { data: remoteReactions }] = await Promise.all([
            supabase.from('messages').select('*').order('created_at', { ascending: true }),
            supabase.from('message_reactions').select('*')
          ]);

          if (remoteMsgs && remoteMsgs.length > 0) {
            for (const item of remoteMsgs) {
              const isAudioData = typeof item.content === 'string' && item.content.startsWith('data:audio/');
              const resolvedType: MessageType = isAudioData ? 'voice' : (item.message_type || 'text');
              const localUuid = item.local_uuid || item.id;

              const existingLocal = await ivyDb.messages.get(localUuid);
              // Preserve local queued/sending status if unsynced
              let status: Message['status'] = 'Sent';
              if (item.status === 'read' || item.status === 'Read') status = 'Read';
              else if (item.status === 'delivered' || item.status === 'Delivered') status = 'Delivered';

              if (existingLocal && (existingLocal.status === 'Sending' || existingLocal.status === 'Queued')) {
                status = existingLocal.status;
              }

              const msg: Message = {
                id: item.id,
                local_uuid: localUuid,
                sender_id: item.sender_id,
                receiver_id: item.receiver_id || '',
                content: item.content,
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
                created_at: item.created_at,
                updated_at: item.updated_at || item.created_at,
                reactions: []
              };
              await ivyDb.messages.put(msg);
            }
          }

          if (remoteReactions && remoteReactions.length > 0) {
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

    // 1. Save to local IndexedDB immediately
    await ivyDb.messages.put(newMessage);

    // 2. Enqueue in SyncQueue
    await syncQueue.enqueue('SEND_MESSAGE', newMessage as unknown as Record<string, unknown>);

    // 3. Trigger queue processor in background
    queueProcessor.processQueue();

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
  subscribeToRealtimeMessages(onMessageReceived: (msg: Message) => void): () => void {
    this.realtimeUnsubscribe?.();
    if (!supabase) return () => {};

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
            const isAudioData = typeof item.content === 'string' && item.content.startsWith('data:audio/');
            const resolvedType: MessageType = isAudioData ? 'voice' : (item.message_type || 'text');
            const localUuid = item.local_uuid || item.id;

            const existingLocal = await ivyDb.messages.get(localUuid);
            let status: Message['status'] = 'Sent';
            if (item.status === 'read' || item.status === 'Read') status = 'Read';
            else if (item.status === 'delivered' || item.status === 'Delivered') status = 'Delivered';

            if (existingLocal && (existingLocal.status === 'Sending' || existingLocal.status === 'Queued')) {
              status = existingLocal.status;
            }

            const msg: Message = {
              id: item.id,
              local_uuid: localUuid,
              sender_id: item.sender_id,
              receiver_id: item.receiver_id || '',
              content: item.content,
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
              created_at: item.created_at || new Date().toISOString(),
              updated_at: item.updated_at || new Date().toISOString(),
              reactions: []
            };

            await ivyDb.messages.put(msg);
            const msgs = await this.getMessages();
            const resolvedMsg = msgs.find((m) => m.local_uuid === localUuid || m.id === item.id) || msg;
            onMessageReceived(resolvedMsg);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        async () => {
          const msgs = await this.getMessages();
          if (msgs.length > 0) {
            onMessageReceived(msgs[msgs.length - 1]);
          }
        }
      )
      .subscribe();

    const unsubscribe = () => {
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
