import type { Message } from '../types';

export function isMessageFromUser(message: Message, userId: string): boolean {
  return message.sender_id === userId;
}

export function generateLocalUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'local_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}
