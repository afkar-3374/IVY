import React from 'react';
import { motion } from 'framer-motion';
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
}

/** 1–3 emoji and nothing else: shown big, without a bubble. */
function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 16) return false;
  const emoji = trimmed.match(/\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic}|\ufe0f)*/gu);
  return Boolean(emoji && emoji.length <= 3 && trimmed.replace(/\p{Extended_Pictographic}|\u200d|\ufe0f|\s/gu, '') === '');
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
  isLastInGroup = true,
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
          <Clock className={`w-3 h-3 animate-pulse ${bigEmoji ? 'text-stone-400' : 'text-white/80'}`} />
        </span>
      );
    }
    if (message.status === 'Sent') {
      return (
        <span title="Sent">
          <Check className={`w-3.5 h-3.5 ${bigEmoji ? 'text-stone-400' : 'text-white/85'}`} />
        </span>
      );
    }
    if (message.status === 'Delivered') {
      return (
        <span title="Delivered">
          <CheckCheck className={`w-3.5 h-3.5 ${bigEmoji ? 'text-stone-400' : 'text-white/85'}`} />
        </span>
      );
    }
    if (message.status === 'Failed') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onRetry) onRetry(message);
          }}
          className={`flex items-center gap-1 font-bold hover:underline ${bigEmoji ? 'text-rose-500' : 'text-white'}`}
          title="Failed to send. Tap to retry."
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      );
    }
    return (
      <motion.span title="Read" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
        <CheckCheck className={`w-3.5 h-3.5 ${bigEmoji ? 'text-[#E05A74]' : 'text-white'}`} strokeWidth={2.5} />
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
        <div className={`glass flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-full text-[11px] font-semibold ${
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

  return (
    <motion.div
      id={`msg-${message.local_uuid}`}
      initial={isFresh ? { opacity: 0, x: isMine ? 28 : -28, y: 8, scale: 0.85 } : false}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      drag={onSwipeToReply ? 'x' : false}
      dragConstraints={{ left: 0, right: 60 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 40 && onSwipeToReply) {
          onSwipeToReply(message);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress(message);
      }}
      className={`flex flex-col relative max-w-[82%] sm:max-w-[70%] ${
        isMine ? 'ml-auto items-end' : 'mr-auto items-start'
      } ${isFirstInGroup ? 'mt-3' : 'mt-0.5'} ${hasReactions ? 'mb-4' : ''}`}
    >
      {/* Pinned / Starred Badge */}
      {(message.pinned || message.starred) && (
        <div className="flex items-center gap-1 text-[10px] text-stone-400 dark:text-stone-500 mb-0.5 px-1">
          {message.pinned && <Pin className="w-3 h-3 text-[#C95565]" />}
          {message.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
        </div>
      )}

      {/* Main Bubble Container */}
      <div
        onClick={() => onLongPress(message)}
        className={`relative text-[15px] leading-snug transition-transform duration-200 cursor-pointer active:scale-[0.98] select-none ${
          bigEmoji
            ? 'px-1 py-0'
            : `px-3.5 py-2 rounded-[1.35rem] ${
                isMine
                  ? `bubble-mine ${isFirstInGroup ? '' : 'rounded-tr-md'} ${isLastInGroup ? 'rounded-br-md' : 'rounded-br-md'}`
                  : `glass text-stone-800 dark:text-stone-100 ${isFirstInGroup ? '' : 'rounded-tl-md'} ${isLastInGroup ? 'rounded-bl-md' : 'rounded-bl-md'}`
              }`
        } ${message.deleted ? 'italic opacity-70' : ''}`}
      >
        {/* Reply Reference Preview Card */}
        {message.reply_to_msg && !message.deleted && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onJumpToOriginal && message.reply_to) {
                onJumpToOriginal(message.reply_to);
              }
            }}
            className={`mb-1.5 px-2.5 py-1.5 rounded-xl text-xs border-l-[3px] cursor-pointer transition-opacity hover:opacity-80 ${
              isMine
                ? 'bg-white/25 border-white/80'
                : 'bg-rose-50/80 dark:bg-white/5 border-[#E05A74]'
            }`}
            title="Tap to jump to original message"
          >
            <p className={`font-bold text-[11px] flex items-center gap-1 ${isMine ? 'text-white' : 'text-[#C95565]'}`}>
              {getReplyIcon(message.reply_to_msg.message_type)}
              <span>{message.reply_to_msg.sender_name}</span>
            </p>
            <p className={`truncate text-[11px] mt-0.5 ${isMine ? 'text-white/85' : 'text-stone-600 dark:text-stone-300'}`}>
              {message.reply_to_msg.content}
            </p>
          </div>
        )}

        {/* Big encrypted file still downloading */}
        {!message.content && !message.deleted ? (
          <div className="flex items-center gap-2 py-1 pr-1 text-xs opacity-90">
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {isImageMsg ? 'Loading photo…' : isVideoMsg ? 'Loading video…' : isVoiceNote ? 'Loading voice note…' : 'Loading file…'}
          </div>
        ) : isDocumentMsg && !message.deleted ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onMediaClick) onMediaClick(message);
            }}
            className="my-1 p-2.5 rounded-2xl bg-white/70 dark:bg-stone-800/70 border border-stone-200/60 dark:border-stone-700/60 flex items-center gap-3 max-w-xs shadow-xs cursor-pointer hover:opacity-90 active-scale"
          >
            <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-700/60 flex-shrink-0">
              {getDocIcon(fileCategory)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                Document Attachment
              </p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 font-semibold uppercase mt-0.5">
                {getFileExtensionLabel(message.content)} File
              </p>
            </div>
            <a
              href={message.content}
              download="attachment"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:text-[#C95565]"
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
            className="my-1 rounded-2xl overflow-hidden shadow-soft cursor-pointer transition-transform hover:scale-[1.01] active-scale group relative max-w-xs bg-black"
          >
            <video
              src={message.content}
              className="w-full h-auto max-h-60 object-cover rounded-2xl opacity-90 group-hover:opacity-100 transition-opacity"
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-white ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded-md text-[10px] text-white font-bold backdrop-blur-xs flex items-center gap-1">
              <Video className="w-3 h-3 text-[#C95565]" />
              <span>Video</span>
            </div>
          </div>
        ) : isImageMsg && !message.deleted ? (
          /* Image Content */
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onMediaClick) onMediaClick(message);
            }}
            className="my-1 rounded-2xl overflow-hidden shadow-soft cursor-pointer transition-transform hover:scale-[1.01] active-scale group relative max-w-xs"
          >
            <img
              src={message.content}
              alt="Shared image"
              className="w-full h-auto max-h-60 object-cover rounded-2xl"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-semibold px-2 py-1 bg-black/40 rounded-full backdrop-blur-sm">
                Tap to expand
              </span>
            </div>
          </div>
        ) : isVoiceNote && !message.deleted ? (
          /* Voice Note Audio Player */
          <div className="py-1">
            <AudioPlayer id={message.local_uuid} src={message.content} />
          </div>
        ) : (
          bigEmoji ? (
            <motion.p
              className="text-5xl leading-none py-1"
              initial={isFresh ? { scale: 0.3, rotate: -15 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 12 }}
            >
              {message.content}
            </motion.p>
          ) : (
            /* Text Content */
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )
        )}

        {/* Timestamp & Status Footer */}
        <div className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 -mb-0.5 ${isMine && !bigEmoji ? 'text-white/80' : 'text-stone-400 dark:text-stone-400'}`}>
          {message.edited && <span>(edited)</span>}
          <span>{formatMessageTime(message.created_at)}</span>
          {renderStatus()}
        </div>

        {/* Reactions Pill Badge */}
        {hasReactions && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onReactionClick) onReactionClick(message);
            }}
            className={`glass absolute -bottom-3.5 ${
              isMine ? 'right-2' : 'left-2'
            } flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer active:scale-95 z-20 ${
              hasUserReacted ? 'ring-1 ring-[#E05A74]/50' : ''
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
