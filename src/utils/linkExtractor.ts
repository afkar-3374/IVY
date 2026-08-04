import type { Message } from '../types';

export interface ExtractedLink {
  id: string;
  messageLocalUuid: string;
  url: string;
  domain: string;
  createdAt: string;
  senderId: string;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

/**
 * Extract all HTTP/HTTPS links from messages
 */
export function extractLinksFromMessages(messages: Message[]): ExtractedLink[] {
  const links: ExtractedLink[] = [];

  messages.forEach((msg) => {
    if (msg.deleted || !msg.content) return;

    const matches = msg.content.match(URL_REGEX);
    if (matches) {
      matches.forEach((url, idx) => {
        try {
          const parsedUrl = new URL(url);
          links.push({
            id: `${msg.local_uuid}_link_${idx}`,
            messageLocalUuid: msg.local_uuid,
            url,
            domain: parsedUrl.hostname.replace(/^www\./, ''),
            createdAt: msg.created_at,
            senderId: msg.sender_id,
          });
        } catch {
          // Invalid URL format
        }
      });
    }
  });

  return links;
}
