import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Check,
  CheckCheck,
  Clock,
  Pin,
  Star,
  CornerDownLeft,
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Phone,
  AlertCircle,
  Mic,
  FileText,
  Image as ImageIcon,
  Video,
  Play,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  File,
  Download,
  ChevronDown,
  Reply,
} from 'lucide-react';
import type { Message } from '../../types';
import { formatMessageTime } from '../../utils/date';
import { isMessageFromUser } from '../../utils/message';
import { useAuthStore } from '../../store/useAuthStore';
import { useCallStore } from '../../store/useCallStore';
import { AudioPlayer } from './AudioPlayer';
import { getFileCategory, getFileExtensionLabel } from '../../utils/fileIcons';

interface MessageBubbleProps {
  message: Message;
  onLongPress: (msg: Message) => void;
  onReactionClick?: (msg: Message) => void;
  onMediaClick?: (msg: Message) => void;
  onSwipeToReply?: (msg: Message) => void;
  onRetry?: (msg: Message) => void;
  onJumpToOriginal?: (localUuid: string) => void;
  /** First/last of a run of messages from the same person (shapes the bubble corners) */
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  /** Search term to highlight in the text */
  highlight?: string;
}

/** Wrap each case-insensitive match of `term` in a highlight. */
function highlightText(text: string, term?: string): React.ReactNode {
  if (!term) return text;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(term);
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<mark key={at} className="bg-[#ffe066] text-inherit rounded-sm">{text.slice(at, at + term.length)}</mark>);
    from = at + term.length;
    at = lower.indexOf(term, from);
  }
  parts.push(text.slice(from));
  return parts;
}

/** 1–3 emoji and nothing else: shown big, without a bubble. */
function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 16) return false;
  const emoji = trimmed.match(/\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic}|\ufe0f)*/gu);
  return Boolean(emoji && emoji.length <= 3 && trimmed.replace(/\p{Extended_Pictographic}|\u200d|\ufe0f|\s/gu, '') === '');
}


const LONG_PRESS_MS = 450;

/** Press and hold (touch) opens the menu; moving the finger (scrolling, swiping) cancels it. */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  return {
    cancel,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') return; // desktop uses right-click or the hover arrow
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          timer.current = null;
          navigator.vibrate?.(25);
          // Lifting the finger would "click" whatever menu button opened under it
          const swallow = (ev: Event) => {
            ev.preventDefault();
            ev.stopPropagation();
          };
          window.addEventListener('click', swallow, { capture: true, once: true });
          setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 800);
          onLongPress();
        }, LONG_PRESS_MS);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
    },
  };
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onLongPress,
  onReactionClick,
  onMediaClick,
  onSwipeToReply,
  onRetry,
  onJumpToOriginal,
  isFirstInGroup = true,
  highlight,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const isMine = currentUser ? isMessageFromUser(message, currentUser.id) : false;

  const isVoiceNote =
    message.message_type === 'voice' ||
    (typeof message.content === 'string' && message.content.startsWith('data:audio/'));

  const isImageMsg =
    message.message_type === 'image' ||
    (typeof message.content === 'string' && message.content.startsWith('data:image/'));

  const isVideoMsg =
    message.message_type === 'video' ||
    (typeof message.content === 'string' && message.content.startsWith('data:video/'));

  const isDocumentMsg =
    message.message_type === 'document' ||
    message.message_type === 'file' ||
    (!isImageMsg && !isVideoMsg && !isVoiceNote && message.message_type !== 'text' && message.message_type !== 'system');

  const isSystemMsg = message.message_type === 'system';
  // Only messages that just arrived animate in (not the whole history on load)
  const isFresh = Date.now() - new Date(message.created_at).getTime() < 8000;
  const bigEmoji = message.message_type === 'text' && !message.deleted && !message.reply_to_msg && isEmojiOnly(message.content);
  const hasReactions = Boolean(message.reactions && message.reactions.length > 0);
  const hasUserReacted = Boolean(
    currentUser && message.reactions?.some((r) => r.profile_id === currentUser.id)
  );
  const longPress = useLongPress(() => onLongPress(message));
  // Swipe right to reply: a reply arrow fades in as the bubble slides
  const dragX = useMotionValue(0);
  const replyIconOpacity = useTransform(dragX, [6, 34], [0, 1]);
  const replyIconScale = useTransform(dragX, [6, 34], [0.4, 1]);

  const getReplyIcon = (type?: string) => {
    if (type === 'voice') return <Mic className="w-3 h-3 text-[#C95565]" />;
    if (type === 'image') return <ImageIcon className="w-3 h-3 text-[#C95565]" />;
    if (type === 'video') return <Video className="w-3 h-3 text-[#C95565]" />;
    if (type === 'document' || type === 'file') return <FileText className="w-3 h-3 text-[#C95565]" />;
    return <CornerDownLeft className="w-3 h-3 text-[#C95565]" />;
  };

  const renderStatus = () => {
    if (!isMine) return null;
    if (message.status === 'Sending' || message.status === 'Queued') {
      return (
        <span title="Sending...">
          <Clock className="w-3 h-3 text-[#8696a0]" />
        </span>
      );
    }
    // WhatsApp-style ticks: ✓ sent · ✓✓ delivered · blue ✓✓ read
    if (message.status === 'Sent') {
      return (
        <motion.span title="Sent" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Check className="w-4 h-4 text-[#8696a0]" strokeWidth={2.2} />
        </motion.span>
      );
    }
    if (message.status === 'Delivered') {
      return (
        <motion.span title="Delivered" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCheck className="w-4 h-4 text-[#8696a0]" strokeWidth={2.2} />
        </motion.span>
      );
    }
    if (message.status === 'Failed') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onRetry) onRetry(message);
          }}
          className="flex items-center gap-1 font-semibold text-rose-500 hover:underline"
          title="Failed to send. Tap to retry."
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      );
    }
    return (
      <motion.span title="Read" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
        <CheckCheck className="w-4 h-4 text-[#53bdeb]" strokeWidth={2.2} />
      </motion.span>
    );
  };

  const getDocIcon = (category: string) => {
    if (category === 'pdf' || category === 'word') return <FileText className="w-6 h-6 text-[#C95565]" />;
    if (category === 'excel') return <FileSpreadsheet className="w-6 h-6 text-emerald-500" />;
    if (category === 'code' || category === 'text') return <FileCode className="w-6 h-6 text-amber-500" />;
    if (category === 'archive') return <FileArchive className="w-6 h-6 text-purple-500" />;
    return <File className="w-6 h-6 text-stone-400" />;
  };

  if (isSystemMsg) {
    const textLower = message.content.toLowerCase();
    const isCall = textLower.includes('call');
    const isMissed = textLower.includes('missed');
    const isDeclined = textLower.includes('declined');
    const isEnded = textLower.includes('ended');
    const isBusy = textLower.includes('busy');

    const handleRedial = (e: React.MouseEvent) => {
      e.stopPropagation();
      const partnerId = isMine ? message.receiver_id : message.sender_id;
      if (currentUser && partnerId) {
        useCallStore.getState().startCall(currentUser.id, partnerId, 'audio');
      }
    };

    return (
      <motion.div
        className="flex justify-center my-3 select-none"
        initial={isFresh ? { opacity: 0, scale: 0.9 } : false}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className={`wa-pill flex items-center gap-2 !text-[12.5px] ${
          isMissed
            ? 'text-rose-600 dark:text-rose-300'
            : isDeclined || isBusy
            ? 'text-amber-600 dark:text-amber-300'
            : isEnded
            ? 'text-emerald-600 dark:text-emerald-300'
            : 'text-stone-600 dark:text-stone-300'
        }`}>
          {isMissed ? (
            <PhoneMissed className="w-4 h-4 text-rose-500 flex-shrink-0" />
          ) : isDeclined || isBusy ? (
            <PhoneOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
          ) : isEnded ? (
            <PhoneCall className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          ) : isCall ? (
            <Phone className="w-4 h-4 text-[#C95565] flex-shrink-0" />
          ) : null}

          <span>{message.content}</span>

          <span className="text-[10px] opacity-60 ml-1">
            {formatMessageTime(message.created_at)}
          </span>

          {isCall && (
            <button
              onClick={handleRedial}
              className="ml-1 p-1 rounded-full bg-white dark:bg-stone-800 shadow-soft hover:scale-110 active:scale-95 transition-all text-[#C95565]"
              title="Call back"
              aria-label="Call back"
            >
              <Phone className="w-3 h-3" />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  const fileCategory = getFileCategory(message.content);
  const isMedia = (isImageMsg || isVideoMsg) && !message.deleted && Boolean(message.content);
  const isPlainText = !isMedia && !isVoiceNote && !isDocumentMsg && !bigEmoji;

  const meta = (
    <>
      {message.pinned && <Pin className="w-3 h-3" />}
      {message.starred && <Star className="w-3 h-3 fill-current" />}
      {message.edited && <span>edited</span>}
      <span>{formatMessageTime(message.created_at)}</span>
      {renderStatus()}
    </>
  );

  return (
    <motion.div
      id={`msg-${message.local_uuid}`}
      initial={isFresh ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{ x: dragX }}
      drag={onSwipeToReply ? 'x' : false}
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.8 }}
      dragSnapToOrigin
      onDragStart={longPress.cancel}
      onDragEnd={(_, info) => {
        if (info.offset.x > 40 && onSwipeToReply) {
          navigator.vibrate?.(10);
          onSwipeToReply(message);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(message);
      }}
      className={`group flex flex-col relative max-w-[80%] sm:max-w-[65%] ${
        isMine ? 'ml-auto items-end mr-2' : 'mr-auto items-start ml-2'
      } ${isFirstInGroup ? 'mt-2.5' : 'mt-[3px]'} ${hasReactions ? 'mb-4' : ''}`}
    >
      {onSwipeToReply && (
        <motion.span
          style={{ opacity: replyIconOpacity, scale: replyIconScale }}
          className="absolute top-1/2 -mt-4 -left-9 w-8 h-8 rounded-full bg-black/20 dark:bg-white/10 text-white flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <Reply className="w-4 h-4" />
        </motion.span>
      )}

      {/* Main Bubble Container: press and hold for the menu, like WhatsApp */}
      <div
        {...longPress.handlers}
        className={`select-none [-webkit-touch-callout:none] ${
          bigEmoji ? 'relative px-1' : `wa-bubble ${isMine ? 'wa-out' : 'wa-in'} ${isFirstInGroup ? 'wa-tail' : ''} ${isMedia ? '!p-[3px]' : ''}`
        } ${message.deleted ? 'italic opacity-70' : ''}`}
      >
        {/* Desktop: menu arrow on hover */}
        {!bigEmoji && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLongPress(message);
            }}
            className={`hidden [@media(hover:hover)]:flex absolute top-0.5 right-0.5 z-10 w-6 h-6 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-[#8696a0] ${
              isMine ? 'bg-[#ffe1e8] dark:bg-[#6b2a3d]' : 'bg-white dark:bg-[#202c33]'
            }`}
            aria-label="Message options"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {/* Reply Reference Preview Card */}
        {message.reply_to_msg && !message.deleted && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onJumpToOriginal && message.reply_to) {
                onJumpToOriginal(message.reply_to);
              }
            }}
            className={`mb-1 px-2.5 py-1.5 rounded-md text-xs border-l-4 border-[#E05A74] bg-black/[0.05] dark:bg-white/5 cursor-pointer hover:opacity-80 ${isMedia ? 'm-[3px]' : ''}`}
            title="Tap to jump to original message"
          >
            <p className="font-semibold text-[12.5px] text-[#E05A74] flex items-center gap-1">
              {getReplyIcon(message.reply_to_msg.message_type)}
              <span>{message.reply_to_msg.sender_name}</span>
            </p>
            <p className="truncate text-[13px] text-[#667781] dark:text-[#8696a0]">
              {message.reply_to_msg.content}
            </p>
          </div>
        )}

        {/* Big encrypted file still downloading */}
        {!message.content && !message.deleted ? (
          <div className="flex items-center gap-2 py-1 pr-1 text-[13px] text-[#667781] dark:text-[#8696a0]">
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {isImageMsg ? 'Loading photo…' : isVideoMsg ? 'Loading video…' : isVoiceNote ? 'Loading voice note…' : 'Loading file…'}
          </div>
        ) : isDocumentMsg && !message.deleted ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onMediaClick) onMediaClick(message);
            }}
            className="mt-0.5 p-2.5 rounded-md bg-black/[0.05] dark:bg-white/5 flex items-center gap-3 w-64 max-w-full cursor-pointer"
          >
            <div className="flex-shrink-0">{getDocIcon(fileCategory)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-[#111b21] dark:text-[#e9edef] truncate">Document</p>
              <p className="text-[11px] text-[#667781] dark:text-[#8696a0] uppercase">
                {getFileExtensionLabel(message.content)}
              </p>
            </div>
            <a
              href={message.content}
              download="attachment"
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full border border-[#8696a0]/50 text-[#8696a0] flex items-center justify-center"
              title="Download File"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        ) : isVideoMsg && !message.deleted ? (
          /* Video Content */
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onMediaClick) onMediaClick(message);
            }}
            className="rounded-[5px] overflow-hidden cursor-pointer relative w-64 max-w-full bg-black"
          >
            <video src={message.content} className="w-full h-auto max-h-80 object-cover" preload="metadata" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/45 text-white flex items-center justify-center">
                <Play className="w-6 h-6 fill-white ml-0.5" />
              </div>
            </div>
          </div>
        ) : isImageMsg && !message.deleted ? (
          /* Image Content */
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onMediaClick) onMediaClick(message);
            }}
            className="rounded-[5px] overflow-hidden cursor-pointer relative w-64 max-w-full"
          >
            <img src={message.content} alt="Shared image" className="w-full h-auto max-h-80 object-cover" loading="lazy" draggable={false} />
          </div>
        ) : isVoiceNote && !message.deleted ? (
          /* Voice Note Audio Player */
          <div className="pt-0.5 pb-3 w-64 max-w-full">
            <AudioPlayer id={message.local_uuid} src={message.content} />
          </div>
        ) : bigEmoji ? (
          <motion.p
            className="text-5xl leading-none py-1"
            initial={isFresh ? { scale: 0.3 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          >
            {message.content}
          </motion.p>
        ) : (
          /* Text Content (the invisible spacer keeps the time from overlapping the last line) */
          <span className="whitespace-pre-wrap break-words">
            {highlightText(message.content, highlight)}
            <span
              className="inline-block"
              style={{ width: (isMine ? 70 : 50) + (message.edited ? 40 : 0) + (message.starred ? 16 : 0) + (message.pinned ? 16 : 0) }}
              aria-hidden
            />
          </span>
        )}

        {/* Timestamp & Status */}
        {isMedia ? (
          <div className="absolute bottom-2 right-2.5 flex items-center gap-1 text-[11px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)] [&_svg]:!text-white">
            {meta}
          </div>
        ) : bigEmoji ? (
          <div className={`wa-pill wa-meta !px-1.5 !py-0.5 flex items-center gap-1 mt-0.5 w-fit ${isMine ? 'ml-auto' : ''}`}>{meta}</div>
        ) : (
          <div className={`wa-meta flex items-center gap-1 ${isPlainText ? 'absolute bottom-1 right-2' : 'justify-end -mt-3'}`}>{meta}</div>
        )}

        {/* Reactions Pill Badge */}
        {hasReactions && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onReactionClick) onReactionClick(message);
            }}
            className={`absolute -bottom-4 ${
              isMine ? 'right-2' : 'left-2'
            } flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-sm bg-white dark:bg-[#202c33] shadow-[0_1px_3px_rgba(11,20,26,0.2)] border border-[#efeae2] dark:border-[#0b141a] cursor-pointer active:scale-95 z-20 ${
              hasUserReacted ? 'ring-1 ring-[#53bdeb]/40' : ''
            }`}
            title="View reaction details"
          >
            {message.reactions!.map((r) => (
              <span key={r.id || r.emoji} className="text-xs">{r.emoji}</span>
            ))}
            {message.reactions!.length > 1 && (
              <span className="text-[10px] font-bold opacity-80">{message.reactions!.length}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
