import React from 'react';
import { CornerDownLeft, FileText, Image as ImageIcon, Mic, Phone, Video } from 'lucide-react';
import type { MessageType } from '../../types';

/** What to show instead of a media message's raw content (a link or file data). */
export function replySummary(type: MessageType | undefined, content: string, deleted?: boolean): string {
  if (deleted) return 'This message was deleted.';
  switch (type) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'voice':
    case 'audio':
      return 'Voice message';
    case 'document':
    case 'file': {
      // a readable file name if the link has one
      const name = decodeURIComponent((content.split('?')[0].split('/').pop() || '').trim());
      return name && name.length < 60 && /\.[a-z0-9]{2,5}$/i.test(name) ? name : 'Document';
    }
    case 'system':
      return content.startsWith('{') ? 'Call' : content;
    default:
      return content.replace(/\s+/g, ' ').trim();
  }
}

/** Only real pictures can be shown as a thumbnail (not encrypted or missing content). */
const showable = (src: string) => /^(data:image\/|blob:|https?:\/\/)/.test(src);

const Icon: React.FC<{ type?: MessageType; className: string }> = ({ type, className }) => {
  if (type === 'voice' || type === 'audio') return <Mic className={className} />;
  if (type === 'image') return <ImageIcon className={className} />;
  if (type === 'video') return <Video className={className} />;
  if (type === 'document' || type === 'file') return <FileText className={className} />;
  if (type === 'system') return <Phone className={className} />;
  return <CornerDownLeft className={className} />;
};

interface ReplyQuoteProps {
  /** "You" or your partner's name */
  who: string;
  type?: MessageType;
  content: string;
  deleted?: boolean;
  /** Bigger text for the box above the keyboard */
  large?: boolean;
}

/**
 * The quoted message at the top of a reply (in a bubble, or above the keyboard while
 * replying): the sender, a one-line summary, and a thumbnail for photos.
 */
export const ReplyQuote: React.FC<ReplyQuoteProps> = ({ who, type, content, deleted, large }) => {
  const isMedia = type !== 'text' && type !== 'system';
  const thumb = !deleted && type === 'image' && showable(content) ? content : null;
  const summary = replySummary(type, content, deleted);
  return (
    <div className="flex items-stretch gap-2 min-w-0 w-full">
      <div className={`flex-1 min-w-0 ${large ? 'text-[13px]' : 'text-xs'}`}>
        <p className={`font-semibold text-[#E05A74] flex items-center gap-1 min-w-0 ${large ? '' : 'text-[12.5px]'}`}>
          <span className="truncate">{who}</span>
        </p>
        <p className={`truncate text-[#667781] dark:text-[#8696a0] flex items-center gap-1 ${large ? '' : 'text-[13px]'} ${deleted ? 'italic' : ''}`}>
          {isMedia && !deleted && <Icon type={type} className="w-3.5 h-3.5 shrink-0 text-[#C95565]" />}
          <span className="truncate">{summary}</span>
        </p>
      </div>
      {thumb && <img src={thumb} alt="" className={`${large ? 'w-11 h-11' : 'w-10 h-10'} shrink-0 rounded-md object-cover -my-0.5`} draggable={false} />}
    </div>
  );
};
