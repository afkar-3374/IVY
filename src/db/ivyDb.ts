import Dexie, { type Table } from 'dexie';
import type { Message, UserProfile, MessageReaction, SyncQueueItem, Attachment, CallHistoryRecord } from '../types';

export class IvyDatabase extends Dexie {
  messages!: Table<Message, string>;
  profiles!: Table<UserProfile, string>;
  reactions!: Table<MessageReaction, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  attachments!: Table<Attachment, string>;
  callLogs!: Table<CallHistoryRecord, string>;

  constructor() {
    super('ivy_db');

    // Version 1 Schema Definition
    this.version(1).stores({
      messages: 'local_uuid, id, sender_id, receiver_id, status, created_at, pinned, starred, deleted',
      profiles: 'id, login_id_hash, display_name',
      reactions: 'id, message_id, profile_id, emoji',
      syncQueue: 'id, action_type, status, created_at',
      attachments: 'id, message_id, file_name, mime_type'
    });

    // Version 2 Schema Migration & Upgrade handling (preserves data safely)
    this.version(2).stores({
      messages: 'local_uuid, id, sender_id, receiver_id, status, created_at, pinned, starred, deleted, message_type',
      profiles: 'id, login_id_hash, display_name, theme',
      reactions: 'id, message_id, profile_id, emoji',
      syncQueue: 'id, action_type, status, created_at',
      attachments: 'id, message_id, file_name, mime_type, file_size'
    }).upgrade(tx => {
      return tx.table('messages').toCollection().modify(msg => {
        if (!msg.status) msg.status = 'Sent';
        if (msg.deleted === undefined) msg.deleted = false;
      });
    });

    // Version 3 Schema Migration (adds call logs)
    this.version(3).stores({
      messages: 'local_uuid, id, sender_id, receiver_id, status, created_at, pinned, starred, deleted, message_type',
      profiles: 'id, login_id_hash, display_name, theme',
      reactions: 'id, message_id, profile_id, emoji',
      syncQueue: 'id, action_type, status, created_at',
      attachments: 'id, message_id, file_name, mime_type, file_size',
      callLogs: 'id, caller_id, receiver_id, call_type, status, created_at'
    });
  }
}

export const ivyDb = new IvyDatabase();

