import { syncQueue } from './syncQueue';
import { networkMonitor } from './networkMonitor';
import { conflictResolver } from './conflictResolver';
import { ivyDb } from '../../db/ivyDb';
import { logger } from '../logger/logger';
import { supabase } from '../supabaseClient';
import type { Message, MessageReaction } from '../../types';

class QueueProcessor {
  private isProcessing = false;
  private intervalId?: number;

  constructor() {
    // Subscribe to network changes to automatically process queue on reconnect
    networkMonitor.subscribe(isOnline => {
      if (isOnline) {
        this.processQueue();
      }
    });
  }

  public startPeriodicSync(intervalMs = 10000) {
    if (typeof window !== 'undefined' && !this.intervalId) {
      this.intervalId = window.setInterval(() => this.processQueue(), intervalMs);
    }
  }

  public stopPeriodicSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing || !networkMonitor.isOnline()) return;

    this.isProcessing = true;
    logger.sync('Starting queue processing turn...');

    try {
      const pendingItems = await syncQueue.getPending();
      for (const item of pendingItems) {
        if (!networkMonitor.isOnline()) break;

        await syncQueue.updateStatus(item.id, 'Sending');

        try {
          let success = false;

          if (item.action_type === 'SEND_MESSAGE') {
            const msgPayload = item.payload as unknown as Message;

            if (supabase) {
              const { data, error } = await supabase
                .from('messages')
                .insert({
                  local_uuid: msgPayload.local_uuid,
                  sender_id: msgPayload.sender_id,
                  receiver_id: msgPayload.receiver_id,
                  content: msgPayload.content,
                  message_type: msgPayload.message_type || 'text',
                  reply_to: msgPayload.reply_to || null,
                  status: 'sent'
                })
                .select('*')
                .single();

              if (!error && data) {
                await conflictResolver.resolveMessageSync(msgPayload.local_uuid, data.id);
                success = true;
              } else {
                logger.error('Queue error sending message:', error?.message);
              }
            } else {
              // Offline/Local mode fallback confirmation
              await conflictResolver.resolveMessageSync(msgPayload.local_uuid, msgPayload.local_uuid);
              success = true;
            }
          } else if (item.action_type === 'EDIT_MESSAGE') {
            const { local_uuid, content } = item.payload as { local_uuid: string; content: string };
            const now = new Date().toISOString();
            if (supabase) {
              await supabase
                .from('messages')
                .update({ content, edited: true, edited_at: now })
                .eq('local_uuid', local_uuid);
            }
            const local = await ivyDb.messages.get(local_uuid);
            if (local) {
              local.content = content;
              local.edited = true;
              local.edited_at = now;
              await ivyDb.messages.put(local);
            }
            success = true;
          } else if (item.action_type === 'DELETE_MESSAGE') {
            const { local_uuid } = item.payload as { local_uuid: string };
            const now = new Date().toISOString();
            if (supabase) {
              await supabase
                .from('messages')
                .update({ deleted: true, deleted_at: now, content: 'This message was deleted.' })
                .eq('local_uuid', local_uuid);
            }
            const local = await ivyDb.messages.get(local_uuid);
            if (local) {
              local.deleted = true;
              local.deleted_at = now;
              local.content = 'This message was deleted.';
              await ivyDb.messages.put(local);
            }
            success = true;
          } else if (item.action_type === 'PIN_MESSAGE') {
            const { local_uuid, pinned } = item.payload as { local_uuid: string; pinned: boolean };
            if (supabase) {
              await supabase
                .from('messages')
                .update({ pinned })
                .eq('local_uuid', local_uuid);
            }
            const local = await ivyDb.messages.get(local_uuid);
            if (local) {
              local.pinned = pinned;
              await ivyDb.messages.put(local);
            }
            success = true;
          } else if (item.action_type === 'STAR_MESSAGE') {
            const { local_uuid, starred } = item.payload as { local_uuid: string; starred: boolean };
            if (supabase) {
              await supabase
                .from('messages')
                .update({ starred })
                .eq('local_uuid', local_uuid);
            }
            const local = await ivyDb.messages.get(local_uuid);
            if (local) {
              local.starred = starred;
              await ivyDb.messages.put(local);
            }
            success = true;
          } else if (item.action_type === 'ADD_REACTION') {
            const { message_id, profile_id, emoji } = item.payload as { message_id: string; profile_id: string; emoji: string };
            if (supabase) {
              await supabase.from('message_reactions').insert({
                message_id,
                profile_id,
                emoji
              });
            }
            success = true;
          } else if (item.action_type === 'REMOVE_REACTION') {
            const { message_id, profile_id, emoji } = item.payload as { message_id: string; profile_id: string; emoji: string };
            if (supabase) {
              await supabase
                .from('message_reactions')
                .delete()
                .eq('message_id', message_id)
                .eq('profile_id', profile_id)
                .eq('emoji', emoji);
            }
            success = true;
          } else if (item.action_type === 'MARK_READ') {
            const { message_uuids } = item.payload as { message_uuids: string[] };
            if (supabase && message_uuids.length > 0) {
              await supabase
                .from('messages')
                .update({ status: 'read' })
                .in('local_uuid', message_uuids);
            }
            for (const uuid of message_uuids) {
              const local = await ivyDb.messages.get(uuid);
              if (local) {
                local.status = 'Read';
                await ivyDb.messages.put(local);
              }
            }
            success = true;
          } else {
            success = true;
          }

          if (success) {
            await syncQueue.remove(item.id);
            logger.sync(`Successfully processed queue action [${item.action_type}]`, item.id);
          } else {
            await syncQueue.updateStatus(item.id, 'Failed', 'Synchronization returned unconfirmed status');
            // If the message fails, mark local message as Failed
            if (item.action_type === 'SEND_MESSAGE') {
              const msgPayload = item.payload as unknown as Message;
              const local = await ivyDb.messages.get(msgPayload.local_uuid);
              if (local && (local.status === 'Sending' || local.status === 'Queued')) {
                local.status = 'Failed';
                await ivyDb.messages.put(local);
              }
            }
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown sync error';
          logger.error(`Error syncing item ${item.id}:`, errMsg);
          await syncQueue.updateStatus(item.id, 'Failed', errMsg);
          if (item.action_type === 'SEND_MESSAGE') {
            const msgPayload = item.payload as unknown as Message;
            const local = await ivyDb.messages.get(msgPayload.local_uuid);
            if (local && (local.status === 'Sending' || local.status === 'Queued')) {
              local.status = 'Failed';
              await ivyDb.messages.put(local);
            }
          }
        }
      }
    } finally {
      this.isProcessing = false;
      logger.sync('Finished queue processing turn');
    }
  }
}

export const queueProcessor = new QueueProcessor();
