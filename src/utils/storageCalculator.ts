import type { Message } from '../types';
import { formatFileSize } from './fileIcons';

export interface StorageUsageResult {
  totalMediaSize: number;
  totalDocSize: number;
  cachedSize: number;
  formattedMedia: string;
  formattedDocs: string;
  formattedTotal: string;
}

/**
 * Estimate storage footprint of messages and attachments
 */
export function calculateStorageUsage(messages: Message[]): StorageUsageResult {
  let totalMediaSize = 0;
  let totalDocSize = 0;

  messages.forEach((m) => {
    if (m.deleted || !m.content) return;

    const isImage = m.message_type === 'image' || m.content.startsWith('data:image/');
    const isVideo = m.message_type === 'video' || m.content.startsWith('data:video/');
    const isVoice = m.message_type === 'voice' || m.content.startsWith('data:audio/');
    const isDoc = m.message_type === 'document' || m.message_type === 'file';

    const approxBytes = m.content.length;

    if (isImage || isVideo || isVoice) {
      totalMediaSize += approxBytes;
    } else if (isDoc) {
      totalDocSize += approxBytes;
    }
  });

  const total = totalMediaSize + totalDocSize;

  return {
    totalMediaSize,
    totalDocSize,
    cachedSize: total,
    formattedMedia: formatFileSize(totalMediaSize),
    formattedDocs: formatFileSize(totalDocSize),
    formattedTotal: formatFileSize(total),
  };
}
