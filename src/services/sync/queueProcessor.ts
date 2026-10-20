import { syncQueue } from './syncQueue';
import { networkMonitor } from './networkMonitor';
import { conflictResolver } from './conflictResolver';
import { ivyDb } from '../../db/ivyDb';
import { logger } from '../logger/logger';
import { supabase } from '../supabaseClient';
import { seal, hasCoupleKey } from '../crypto/coupleCrypto';
import { pushService } from '../pushService';
import type { Message, MessageReaction } from '../../types';

/** Tell the chat screen how a send ended (it otherwise waits for the realtime echo). */
function announce(localUuid: string, status: Message['status'], id?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ivy:message-status', { detail: { localUuid, status, id } }));
}

/** Reject if `promise` takes longer than `ms`, so one stuck request can't block the queue. */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

class QueueProcessor {
  private isProcessing = false;
  private rerunRequested = false;
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
      // Nothing is being processed yet, so anything marked "Sending" was interrupted
      void syncQueue.resetInterrupted().then(() => this.processQueue());
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
    // Messages can only be encrypted (and so sent) while the chat is unlocked
    if (!networkMonitor.isOnline() || !hasCoupleKey()) return;
    if (this.isProcessing) {
      // Something was queued mid-run: go again right after instead of waiting for the next tick
      this.rerunRequested = true;
      return;
    }

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
              const client = supabase;
              const big = (msgPayload.content?.length || 0) > 200_000;
              let { data, error } = await withTimeout(
                (async () =>
                  client
                    .from('messages')
                    .insert({
                      local_uuid: msgPayload.local_uuid,
                      sender_id: msgPayload.sender_id,
                      receiver_id: msgPayload.receiver_id,
                      content: await seal(msgPayload.content),
                      message_type: msgPayload.message_type || 'text',
                      reply_to: msgPayload.reply_to || null,
                      status: 'sent'
                    })
                    .select('*')
                    .single())(),
                big ? 180_000 : 25_000
              );

              // Already on the server (an earlier attempt got through but its reply was lost)
              if (error && error.code === '23505') {
                ({ data, error } = await client.from('messages').select('*').eq('local_uuid', msgPayload.local_uuid).single());
              }

              if (!error && data) {
                await conflictResolver.resolveMessageSync(msgPayload.local_uuid, data.id);
                announce(msgPayload.local_uuid, 'Sent', data.id);
                if (msgPayload.message_type !== 'system') void pushService.notifyPartner('message');
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
              const { error } = await supabase
                .from('messages')
                .update({ content: await seal(content), edited: true, edited_at: now })
                .eq('local_uuid', local_uuid);
              if (error) throw error;
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
              const { error } = await supabase
                .from('messages')
                .update({ deleted: true, deleted_at: now, content: 'This message was deleted.' })
                .eq('local_uuid', local_uuid);
              if (error) throw error;
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
              const { error } = await supabase
                .from('messages')
                .update({ pinned })
                .eq('local_uuid', local_uuid);
              if (error) throw error;
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
              const { error } = await supabase
                .from('messages')
                .update({ starred })
                .eq('local_uuid', local_uuid);
              if (error) throw error;
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
              const { error } = await supabase.from('message_reactions').insert({
                message_id,
                profile_id,
                emoji
              });
              if (error) throw error;
            }
            success = true;
          } else if (item.action_type === 'REMOVE_REACTION') {
            const { message_id, profile_id, emoji } = item.payload as { message_id: string; profile_id: string; emoji: string };
            if (supabase) {
              const { error } = await supabase
                .from('message_reactions')
                .delete()
                .eq('message_id', message_id)
                .eq('profile_id', profile_id)
                .eq('emoji', emoji);
              if (error) throw error;
            }
            success = true;
          } else if (item.action_type === 'MARK_READ') {
            const { message_uuids } = item.payload as { message_uuids: string[] };
            if (supabase && message_uuids.length > 0) {
              const { error } = await supabase
                .from('messages')
                .update({ status: 'read' })
                .in('local_uuid', message_uuids);
              if (error) throw error;
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
                announce(local.local_uuid, 'Failed');
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
              announce(local.local_uuid, 'Failed');
            }
          }
        }
      }
    } finally {
      this.isProcessing = false;
      logger.sync('Finished queue processing turn');
      if (this.rerunRequested) {
        this.rerunRequested = false;
        void this.processQueue();
      }
    }
  }
}

export const queueProcessor = new QueueProcessor();
