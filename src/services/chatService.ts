import { ivyDb } from '../db/ivyDb';
import { syncQueue } from './sync/syncQueue';
import { queueProcessor } from './sync/queueProcessor';
import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import { generateLocalUuid } from '../utils/message';
import { DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE, USER_1_ID, USER_2_ID } from '../utils/constants';
import type { Message, UserProfile, MessageReaction, MessageType } from '../types';

// Cross-tab broadcast channel for local multi-tab testing
const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('ivy_chat_channel')
  : null;

export class ChatService {
  /**
   * Seed default predefined users in Dexie if not present.
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
  }

  /**
   * Fetch profile by login ID hash.
   */
  async getProfileByHash(hash: string): Promise<UserProfile | null> {
    await this.initPreseededProfiles();
    
    // Check local IndexedDB
    const local = await ivyDb.profiles.where('login_id_hash').equals(hash).first();
    if (local) return local;

    // Check Supabase if configured
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('login_id_hash', hash)
        .single();
      if (!error && data) {
        await ivyDb.profiles.put(data as UserProfile);
        return data as UserProfile;
      }
    }

    return null;
  }

  /**
   * Update User Profile.
   */
  async updateProfile(profile: UserProfile): Promise<void> {
    profile.updated_at = new Date().toISOString();
    await ivyDb.profiles.put(profile);

    await syncQueue.enqueue('UPDATE_PROFILE', profile as unknown as Record<string, unknown>);
    queueProcessor.processQueue();

    if (supabase) {
      await supabase.from('profiles').upsert(profile);
    }
  }

  /**
   * Load paginated messages from IndexedDB (50 items per chunk).
   */
  async getMessages(limit = 50, offset = 0): Promise<Message[]> {
    const all = await ivyDb.messages.orderBy('created_at').toArray();
    // Return newest slice
    const total = all.length;
    const start = Math.max(0, total - limit - offset);
    const end = total - offset;
    return all.slice(start, end);
  }

  /**
   * Create & Send Message with Optimistic UI.
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
      status: 'Sending',
      created_at: now,
      updated_at: now,
      reactions: []
    };

    // 1. Immediately write to IndexedDB (Optimistic UI)
    await ivyDb.messages.put(newMessage);
    logger.info('Optimistically saved message to IndexedDB', localUuid);

    // 2. Broadcast to other tabs locally
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'NEW_MESSAGE', payload: newMessage });
    }

    // 3. Enqueue for background sync
    await syncQueue.enqueue('SEND_MESSAGE', newMessage as unknown as Record<string, unknown>);
    queueProcessor.processQueue();

    return newMessage;
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

      await syncQueue.enqueue('EDIT_MESSAGE', { local_uuid: localUuid, content: newContent });
      queueProcessor.processQueue();
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

      await syncQueue.enqueue('DELETE_MESSAGE', { local_uuid: localUuid });
      queueProcessor.processQueue();
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

      await syncQueue.enqueue('PIN_MESSAGE', { local_uuid: localUuid, pinned: msg.pinned });
      queueProcessor.processQueue();
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

      await syncQueue.enqueue('STAR_MESSAGE', { local_uuid: localUuid, starred: msg.starred });
      queueProcessor.processQueue();
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
        await syncQueue.enqueue('REMOVE_REACTION', { local_uuid: localUuid, userId, emoji });
      } else {
        const newReaction: MessageReaction = {
          id: generateLocalUuid(),
          message_id: localUuid,
          profile_id: userId,
          emoji,
          created_at: new Date().toISOString()
        };
        msg.reactions.push(newReaction);
        await syncQueue.enqueue('ADD_REACTION', { local_uuid: localUuid, reaction: newReaction as unknown as Record<string, unknown> });
      }

      await ivyDb.messages.put(msg);

      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'REACTION_UPDATED', payload: { localUuid, reactions: msg.reactions } });
      }

      queueProcessor.processQueue();
    }
  }
}

export const chatService = new ChatService();
