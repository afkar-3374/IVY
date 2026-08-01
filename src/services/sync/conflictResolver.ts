import { ivyDb } from '../../db/ivyDb';
import type { Message } from '../../types';
import { logger } from '../logger/logger';

export class ConflictResolver {
  /**
   * Reconciles server message with local IndexedDB copy.
   * Preserves local_uuid mapping while updating status to 'Sent'/'Delivered'/'Read'.
   */
  async resolveMessageSync(localUuid: string, serverId: string): Promise<void> {
    const localMsg = await ivyDb.messages.get(localUuid);
    if (localMsg) {
      localMsg.id = serverId; // Link server UUID
      localMsg.status = localMsg.status === 'Queued' || localMsg.status === 'Sending' ? 'Sent' : localMsg.status;
      await ivyDb.messages.put(localMsg);
      logger.sync(`Reconciled message local_uuid: ${localUuid} -> server_id: ${serverId}`);
    }
  }

  /**
   * Deduplicates incoming server messages against existing local messages by local_uuid or id.
   */
  async deduplicateMessages(serverMessages: Message[]): Promise<Message[]> {
    const existing = await ivyDb.messages.toArray();
    const existingUuids = new Set(existing.map(m => m.local_uuid));
    const existingIds = new Set(existing.map(m => m.id));

    return serverMessages.filter(msg => {
      const isDuplicate = existingUuids.has(msg.local_uuid) || (msg.id && existingIds.has(msg.id));
      return !isDuplicate;
    });
  }
}

export const conflictResolver = new ConflictResolver();
