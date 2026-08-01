import { syncQueue } from './syncQueue';
import { networkMonitor } from './networkMonitor';
import { conflictResolver } from './conflictResolver';
import { ivyDb } from '../../db/ivyDb';
import { logger } from '../logger/logger';
import { supabase } from '../supabaseClient';
import type { Message } from '../../types';

class QueueProcessor {
  private isProcessing = false;
  private intervalId?: number;

  constructor() {
    // Subscribe to network changes
    networkMonitor.subscribe(isOnline => {
      if (isOnline) {
        this.processQueue();
      }
    });
  }

  public startPeriodicSync(intervalMs = 15000) {
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
    logger.sync('Starting queue processing...');

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
                .select('id')
                .single();

              if (!error && data) {
                await conflictResolver.resolveMessageSync(msgPayload.local_uuid, data.id);
                success = true;
              }
            } else {
              // Local Fallback simulation
              await conflictResolver.resolveMessageSync(msgPayload.local_uuid, msgPayload.local_uuid);
              success = true;
            }
          } else if (item.action_type === 'EDIT_MESSAGE') {
            const { local_uuid, content } = item.payload as { local_uuid: string; content: string };
            if (supabase) {
              await supabase
                .from('messages')
                .update({ content, edited: true, edited_at: new Date().toISOString() })
                .eq('local_uuid', local_uuid);
            }
            const local = await ivyDb.messages.get(local_uuid);
            if (local) {
              local.content = content;
              local.edited = true;
              local.edited_at = new Date().toISOString();
              await ivyDb.messages.put(local);
            }
            success = true;
          } else if (item.action_type === 'DELETE_MESSAGE') {
            const { local_uuid } = item.payload as { local_uuid: string };
            if (supabase) {
              await supabase
                .from('messages')
                .update({ deleted: true, deleted_at: new Date().toISOString(), content: 'This message was deleted.' })
                .eq('local_uuid', local_uuid);
            }
            const local = await ivyDb.messages.get(local_uuid);
            if (local) {
              local.deleted = true;
              local.deleted_at = new Date().toISOString();
              local.content = 'This message was deleted.';
              await ivyDb.messages.put(local);
            }
            success = true;
          } else {
            // General success for other actions
            success = true;
          }

          if (success) {
            await syncQueue.remove(item.id);
            logger.sync(`Successfully synced action [${item.action_type}]`, item.id);
          } else {
            await syncQueue.updateStatus(item.id, 'Failed', 'Synchronization returned unconfirmed status');
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown sync error';
          logger.error(`Error syncing item ${item.id}:`, errMsg);
          await syncQueue.updateStatus(item.id, 'Failed', errMsg);
        }
      }
    } finally {
      this.isProcessing = false;
      logger.sync('Finished queue processing turn');
    }
  }
}

export const queueProcessor = new QueueProcessor();
