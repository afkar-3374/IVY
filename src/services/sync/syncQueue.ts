import { ivyDb } from '../../db/ivyDb';
import type { SyncQueueItem, QueueActionType } from '../../types';
import { generateLocalUuid } from '../../utils/message';
import { logger } from '../logger/logger';

export class SyncQueue {
  async enqueue(action_type: QueueActionType, payload: Record<string, unknown>): Promise<SyncQueueItem> {
    const item: SyncQueueItem = {
      id: generateLocalUuid(),
      action_type,
      payload,
      retry_count: 0,
      status: 'Queued',
      created_at: new Date().toISOString()
    };

    await ivyDb.syncQueue.put(item);
    logger.sync(`Action [${action_type}] enqueued locally`, item.id);
    return item;
  }

  async getPending(): Promise<SyncQueueItem[]> {
    return await ivyDb.syncQueue
      .where('status')
      .anyOf(['Queued', 'Failed'])
      .sortBy('created_at');
  }

  async updateStatus(id: string, status: SyncQueueItem['status'], error_message?: string): Promise<void> {
    const item = await ivyDb.syncQueue.get(id);
    if (item) {
      item.status = status;
      if (status === 'Failed') {
        item.retry_count += 1;
      }
      if (error_message) {
        item.error_message = error_message;
      }
      await ivyDb.syncQueue.put(item);
    }
  }

  async remove(id: string): Promise<void> {
    await ivyDb.syncQueue.delete(id);
    logger.sync('Queue item removed', id);
  }
}

export const syncQueue = new SyncQueue();
