import { supabase } from './supabaseClient';
import { logger } from './logger/logger';
import { generateLocalUuid } from '../utils/message';
import { DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE, USER_1_ID, USER_2_ID } from '../utils/constants';
import type { Message, UserProfile, MessageReaction, MessageType } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ChatService {
  /**
   * Seed default predefined users directly in Supabase profiles table.
   */
  async initPreseededProfiles(): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('profiles').upsert([DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE], { onConflict: 'id' });
    } catch (err) {
      logger.error('Error seeding profiles to Supabase:', err);
    }
  }

  /**
   * Fetch profile by login ID hash directly from Supabase.
   */
  async getProfileByHash(hash: string): Promise<UserProfile | null> {
    if (!supabase) return null;
    await this.initPreseededProfiles();
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('login_id_hash', hash)
        .single();

      if (!error && data) {
        return data as UserProfile;
      }
    } catch (err) {
      logger.error('Supabase profile query error:', err);
    }

    return null;
  }

  /**
   * Update User Profile directly in Supabase.
   */
  async updateProfile(profile: UserProfile): Promise<void> {
    if (!supabase) return;
    profile.updated_at = new Date().toISOString();
    try {
      await supabase.from('profiles').upsert(profile);
    } catch (err) {
      logger.error('Error updating profile in Supabase:', err);
    }
  }

  /**
   * Fetch all messages directly from Supabase database table `messages`.
   */
  async getMessages(): Promise<Message[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Supabase SELECT messages error:', error.message);
        return [];
      }

      if (data) {
        return data.map((item) => {
          const isAudioData = typeof item.content === 'string' && item.content.startsWith('data:audio/');
          const resolvedType: MessageType = isAudioData ? 'voice' : (item.message_type || 'text');

          return {
            id: item.id,
            local_uuid: item.local_uuid || item.id,
            sender_id: item.sender_id,
            receiver_id: item.receiver_id || '',
            content: item.content,
            message_type: resolvedType,
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
        });
      }
    } catch (err) {
      logger.error('Error fetching messages directly from Supabase:', err);
    }

    return [];
  }

  /**
   * Send message directly to Supabase table `messages`.
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
      status: 'Sent',
      created_at: now,
      updated_at: now,
      reactions: []
    };

    if (!supabase) return newMessage;

    try {
      const payload: Record<string, unknown> = {
        local_uuid: localUuid,
        sender_id: params.sender_id,
        receiver_id: params.receiver_id,
        content: params.content,
        message_type: resolvedType,
        status: 'sent'
      };

      if (params.reply_to && UUID_REGEX.test(params.reply_to)) {
        payload.reply_to = params.reply_to;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        logger.error('Supabase message insert error:', error.message);
        if (error.code === '23503') {
          await supabase.from('profiles').upsert([DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE]);
          const retryRes = await supabase.from('messages').insert(payload).select('*').single();
          if (!retryRes.error && retryRes.data) {
            newMessage.id = retryRes.data.id;
            newMessage.created_at = retryRes.data.created_at;
          }
        }
      } else if (data) {
        newMessage.id = data.id;
        newMessage.created_at = data.created_at;
      }
    } catch (err) {
      logger.error('Supabase sendMessage exception:', err);
    }

    return newMessage;
  }

  /**
   * Subscribe directly to Supabase Realtime channel for postgres_changes on messages table.
   */
  subscribeToRealtimeMessages(onMessageReceived: (msg: Message) => void): () => void {
    if (!supabase) return () => {};

    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          logger.info('Supabase Realtime event:', payload.eventType, payload.new);
          const item = payload.new as any;
          if (item && item.content) {
            const isAudioData = typeof item.content === 'string' && item.content.startsWith('data:audio/');
            const resolvedType: MessageType = isAudioData ? 'voice' : (item.message_type || 'text');

            const msg: Message = {
              id: item.id,
              local_uuid: item.local_uuid || item.id,
              sender_id: item.sender_id,
              receiver_id: item.receiver_id || '',
              content: item.content,
              message_type: resolvedType,
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
            onMessageReceived(msg);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }

  /**
   * Edit message directly in Supabase.
   */
  async editMessage(localUuid: string, newContent: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase
        .from('messages')
        .update({ content: newContent, edited: true, edited_at: new Date().toISOString() })
        .eq('local_uuid', localUuid);
    } catch (err) {
      logger.error('Supabase edit error:', err);
    }
  }

  /**
   * Soft Delete Message directly in Supabase.
   */
  async deleteMessage(localUuid: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase
        .from('messages')
        .update({ deleted: true, deleted_at: new Date().toISOString(), content: 'This message was deleted.' })
        .eq('local_uuid', localUuid);
    } catch (err) {
      logger.error('Supabase delete error:', err);
    }
  }

  /**
   * Toggle Pin Message in Supabase.
   */
  async togglePin(localUuid: string): Promise<void> {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('messages').select('pinned').eq('local_uuid', localUuid).single();
      if (data) {
        await supabase.from('messages').update({ pinned: !data.pinned }).eq('local_uuid', localUuid);
      }
    } catch (err) {
      logger.error('Supabase pin error:', err);
    }
  }

  /**
   * Toggle Star Message in Supabase.
   */
  async toggleStar(localUuid: string): Promise<void> {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('messages').select('starred').eq('local_uuid', localUuid).single();
      if (data) {
        await supabase.from('messages').update({ starred: !data.starred }).eq('local_uuid', localUuid);
      }
    } catch (err) {
      logger.error('Supabase star error:', err);
    }
  }

  /**
   * Toggle Reaction in Supabase.
   */
  async toggleReaction(localUuid: string, userId: string, emoji: string): Promise<void> {
    if (!supabase) return;
    try {
      await supabase.from('message_reactions').insert({
        message_id: localUuid,
        profile_id: userId,
        emoji
      });
    } catch (err) {
      logger.error('Supabase reaction error:', err);
    }
  }
}

export const chatService = new ChatService();
