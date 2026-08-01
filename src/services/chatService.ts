import { ivyDb } from '../db/ivyDb';
import { syncQueue } from './sync/syncQueue';
import { queueProcessor } from './sync/queueProcessor';
import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import { generateLocalUuid } from '../utils/message';
import { DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE, USER_1_ID, USER_2_ID } from '../utils/constants';
import type { Message, UserProfile, MessageReaction, MessageType } from '../types';

const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('ivy_chat_channel')
  : null;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ChatService {
  /**
   * Seed default predefined users in Dexie and Supabase.
   */
  async initPreseededProfiles(): Promise<void> {
    const existing1 = await ivyDb.profiles.get(USER_1_ID);
    if (!existing1) {
      await ivyDb.profiles.put(DEFAULT_USER_1_PROFILE);
    }
    const existing2 = await ivyDb.profiles.get(USER_2_ID);
    if (!existing2) {
      await ivyDb.profiles.put(DEFAULT_USER_2_PROFILE);
    }

    if (supabase) {
      try {
        await supabase.from('profiles').upsert([DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE], { onConflict: 'id' });
        logger.info('Preseeded couple profiles upserted into Supabase DB');
      } catch (err) {
        logger.warn('Could not auto-upsert profiles to Supabase:', err);
      }
    }
  }

  /**
   * Fetch profile by login ID hash from Supabase or IndexedDB.
   */
  async getProfileByHash(hash: string): Promise<UserProfile | null> {
    await this.initPreseededProfiles();
    
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('login_id_hash', hash)
          .single();

        if (!error && data) {
          await ivyDb.profiles.put(data as UserProfile);
          return data as UserProfile;
        }
      } catch (err) {
        logger.warn('Supabase profile query fallback:', err);
      }
    }

    return (await ivyDb.profiles.where('login_id_hash').equals(hash).first()) || null;
  }

  /**
   * Update User Profile.
   */
  async updateProfile(profile: UserProfile): Promise<void> {
    profile.updated_at = new Date().toISOString();
    await ivyDb.profiles.put(profile);

    if (supabase) {
      try {
        await supabase.from('profiles').upsert(profile);
      } catch (err) {
        logger.error('Error syncing profile update to Supabase:', err);
        await syncQueue.enqueue('UPDATE_PROFILE', profile as unknown as Record<string, unknown>);
        queueProcessor.processQueue();
      }
    } else {
      await syncQueue.enqueue('UPDATE_PROFILE', profile as unknown as Record<string, unknown>);
      queueProcessor.processQueue();
    }
  }

  /**
   * Fetch messages from IndexedDB / Supabase.
   */
  async getMessages(limit = 100, offset = 0): Promise<Message[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          logger.warn('Supabase SELECT messages error:', error.message);
        } else if (data && data.length > 0) {
          for (const item of data) {
            const msg: Message = {
              id: item.id,
              local_uuid: item.local_uuid || item.id,
              sender_id: item.sender_id,
              receiver_id: item.receiver_id || '',
              content: item.content,
              message_type: item.message_type || 'text',
              reply_to: item.reply_to,
              edited: item.edited || false,
              deleted: item.deleted || false,
              pinned: item.pinned || false,
              starred: item.starred || false,
              forwarded: item.forwarded || false,
              status: 'Sent',
              created_at: item.created_at,
              updated_at: item.updated_at || item.created_at,
              reactions: []
            };
            await ivyDb.messages.put(msg);
          }
        }
      } catch (err) {
        logger.warn('Error fetching messages from Supabase, relying on IndexedDB:', err);
      }
    }

    // Return all messages from IndexedDB sorted by created_at
    const all = await ivyDb.messages.orderBy('created_at').toArray();
    return all;
  }

  /**
   * Send message with instant 'Sent' checkmark status & multi-channel broadcast.
   */
  async sendMessage(params: {
    sender_id: string;
    receiver_id: string;
    content: string;
    message_type?: MessageType;
    reply_to?: string;
    reply_to_msg?: Message['reply_to_msg'];
  }): Promise<Message> {
    await this.initPreseededProfiles();

    const localUuid = generateLocalUuid();
    const now = new Date().toISOString();

    const newMessage: Message = {
      id: localUuid,
      local_uuid: localUuid,
      sender_id: params.sender_id,
      receiver_id: params.receiver_id,
      content: params.content,
      message_type: params.message_type || 'text',
      reply_to: params.reply_to,
      reply_to_msg: params.reply_to_msg,
      edited: false,
      deleted: false,
      pinned: false,
      starred: false,
      forwarded: false,
      status: 'Sent',
      created_at: now,
      updated_at: now,
      reactions: []
    };

    // 1. Immediately save to IndexedDB
    await ivyDb.messages.put(newMessage);
    logger.info('Saved message to IndexedDB with status Sent', localUuid);

    // 2. Broadcast via BroadcastChannel
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'NEW_MESSAGE', payload: newMessage });
    }

    // 3. Broadcast via LocalStorage Event (cross-window fallback)
    try {
      localStorage.setItem('ivy_message_event', JSON.stringify({ type: 'NEW_MESSAGE', payload: newMessage, ts: Date.now() }));
    } catch {
      // Ignore quota errors
    }

    // 4. Post to Supabase DB asynchronously
    if (supabase) {
      try {
        const payload: Record<string, unknown> = {
          local_uuid: localUuid,
          sender_id: params.sender_id,
          receiver_id: params.receiver_id,
          content: params.content,
          message_type: params.message_type || 'text',
          status: 'sent'
        };

        if (params.reply_to && UUID_REGEX.test(params.reply_to)) {
          payload.reply_to = params.reply_to;
        }

        const { data, error } = await supabase
          .from('messages')
          .insert(payload)
          .select('id')
          .single();

        if (error) {
          logger.warn('Supabase insert error details:', error.message);
          if (error.code === '23503') {
            await supabase.from('profiles').upsert([DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE]);
            const retryRes = await supabase.from('messages').insert(payload).select('id').single();
            if (!retryRes.error && retryRes.data) {
              newMessage.id = retryRes.data.id;
              await ivyDb.messages.put(newMessage);
            }
          }
        } else if (data) {
          newMessage.id = data.id;
          await ivyDb.messages.put(newMessage);
          logger.info('Message synced with Supabase DB ID', data.id);
        }
      } catch (err) {
        logger.warn('Supabase insert exception:', err);
      }
    }

    return newMessage;
  }

  /**
   * Subscribe to Realtime Supabase changes, BroadcastChannel, and LocalStorage events.
   */
  subscribeToRealtimeMessages(onMessageReceived: (msg: Message) => void): () => void {
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    if (supabase) {
      try {
        channel = supabase
          .channel('public:messages')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'messages' },
            (payload) => {
              logger.info('Realtime Supabase event:', payload.eventType, payload.new);
              const item = payload.new as any;
              if (item && item.content) {
                const msg: Message = {
                  id: item.id,
                  local_uuid: item.local_uuid || item.id,
                  sender_id: item.sender_id,
                  receiver_id: item.receiver_id || '',
                  content: item.content,
                  message_type: item.message_type || 'text',
                  reply_to: item.reply_to,
                  edited: item.edited || false,
                  deleted: item.deleted || false,
                  pinned: item.pinned || false,
                  starred: item.starred || false,
                  forwarded: item.forwarded || false,
                  status: 'Sent',
                  created_at: item.created_at || new Date().toISOString(),
                  updated_at: item.updated_at || new Date().toISOString(),
                  reactions: []
                };
                ivyDb.messages.put(msg);
                onMessageReceived(msg);
              }
            }
          )
          .subscribe();
      } catch (err) {
        logger.warn('Error subscribing to Supabase Realtime channel:', err);
      }
    }

    // BroadcastChannel listener
    const handleBroadcast = (e: MessageEvent) => {
      if (e.data && e.data.type === 'NEW_MESSAGE') {
        const msg = e.data.payload as Message;
        ivyDb.messages.put(msg);
        onMessageReceived(msg);
      }
    };

    // Storage Event listener for cross-window / cross-tab receipt
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'ivy_message_event' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.type === 'NEW_MESSAGE' && data.payload) {
            const msg = data.payload as Message;
            ivyDb.messages.put(msg);
            onMessageReceived(msg);
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    };

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcast);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcast);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * Edit Message.
   */
  async editMessage(localUuid: string, newContent: string): Promise<void> {
    const msg = await ivyDb.messages.get(localUuid);
    if (msg) {
      msg.content = newContent;
      msg.edited = true;
      msg.edited_at = new Date().toISOString();
      await ivyDb.messages.put(msg);

      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'MESSAGE_EDITED', payload: { localUuid, newContent } });
      }

      if (supabase) {
        try {
          await supabase
            .from('messages')
            .update({ content: newContent, edited: true, edited_at: new Date().toISOString() })
            .eq('local_uuid', localUuid);
        } catch (err) {
          logger.warn('Supabase edit error:', err);
        }
      }
    }
  }

  /**
   * Soft Delete Message ("This message was deleted.").
   */
  async deleteMessage(localUuid: string): Promise<void> {
    const msg = await ivyDb.messages.get(localUuid);
    if (msg) {
      msg.deleted = true;
      msg.deleted_at = new Date().toISOString();
      msg.content = 'This message was deleted.';
      await ivyDb.messages.put(msg);

      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'MESSAGE_DELETED', payload: { localUuid } });
      }

      if (supabase) {
        try {
          await supabase
            .from('messages')
            .update({ deleted: true, deleted_at: new Date().toISOString(), content: 'This message was deleted.' })
            .eq('local_uuid', localUuid);
        } catch (err) {
          logger.warn('Supabase delete error:', err);
        }
      }
    }
  }

  /**
   * Toggle Pin Message.
   */
  async togglePin(localUuid: string): Promise<void> {
    const msg = await ivyDb.messages.get(localUuid);
    if (msg) {
      msg.pinned = !msg.pinned;
      await ivyDb.messages.put(msg);

      if (supabase) {
        try {
          await supabase.from('messages').update({ pinned: msg.pinned }).eq('local_uuid', localUuid);
        } catch (err) {
          logger.warn('Supabase pin error:', err);
        }
      }
    }
  }

  /**
   * Toggle Star Message.
   */
  async toggleStar(localUuid: string): Promise<void> {
    const msg = await ivyDb.messages.get(localUuid);
    if (msg) {
      msg.starred = !msg.starred;
      await ivyDb.messages.put(msg);

      if (supabase) {
        try {
          await supabase.from('messages').update({ starred: msg.starred }).eq('local_uuid', localUuid);
        } catch (err) {
          logger.warn('Supabase star error:', err);
        }
      }
    }
  }

  /**
   * Toggle Reaction on Message.
   */
  async toggleReaction(localUuid: string, userId: string, emoji: string): Promise<void> {
    const msg = await ivyDb.messages.get(localUuid);
    if (msg) {
      if (!msg.reactions) msg.reactions = [];
      
      const existingIdx = msg.reactions.findIndex(r => r.profile_id === userId && r.emoji === emoji);
      if (existingIdx >= 0) {
        msg.reactions.splice(existingIdx, 1);
      } else {
        const newReaction: MessageReaction = {
          id: generateLocalUuid(),
          message_id: localUuid,
          profile_id: userId,
          emoji,
          created_at: new Date().toISOString()
        };
        msg.reactions.push(newReaction);
      }

      await ivyDb.messages.put(msg);

      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'REACTION_UPDATED', payload: { localUuid, reactions: msg.reactions } });
      }
    }
  }
}

export const chatService = new ChatService();
