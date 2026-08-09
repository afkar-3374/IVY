import React from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  CheckCheck,
  Clock,
  Pin,
  Star,
  PhoneCall,
  PhoneOff,
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
  CornerDownLeft,
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
  /** True when this message is from the same sender as the previous one, within 2 min */
  isConsecutive?: boolean;
  /** True when next message is from a different sender (= last in a cluster) */
  isLastInGroup?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onLongPress,
  onReactionClick,
  onMediaClick,
  onSwipeToReply,
  onRetry,
  onJumpToOriginal,
  isConsecutive = false,
  isLastInGroup = true,
}) => {
  const currentUser = useAuthStore((s) => s.user);
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
    (!isImageMsg && !isVideoMsg && !isVoiceNote &&
     message.message_type !== 'text' && message.message_type !== 'system');
  const isSystemMsg = message.message_type === 'system';
  const hasReactions = Boolean(message.reactions && message.reactions.length > 0);
  const hasUserReacted = Boolean(
    currentUser && message.reactions?.some((r) => r.profile_id === currentUser.id)
  );
  const isMediaOnly = (isImageMsg || isVideoMsg) && !message.reply_to_msg;

  /* ── Reply icon ────────────────────────────────────────────────── */
  const getReplyIcon = (type?: string) => {
    if (type === 'voice') return <Mic className="w-3 h-3 text-[#C95565] flex-shrink-0" />;
    if (type === 'image') return <ImageIcon className="w-3 h-3 text-[#C95565] flex-shrink-0" />;
    if (type === 'video') return <Video className="w-3 h-3 text-[#C95565] flex-shrink-0" />;
    if (type === 'document' || type === 'file')
      return <FileText className="w-3 h-3 text-[#C95565] flex-shrink-0" />;
    return <CornerDownLeft className="w-3 h-3 text-[#C95565] flex-shrink-0" />;
  };

  /* ── Delivery status icon ──────────────────────────────────────── */
  const renderStatus = () => {
    if (!isMine) return null;
    if (message.status === 'Sending' || message.status === 'Queued')
      return <Clock className="w-3 h-3 text-[#7D303C]/50 dark:text-rose-200/40 animate-pulse" />;
    if (message.status === 'Sent')
      return <Check className="w-3.5 h-3.5 text-[#7D303C]/50 dark:text-rose-200/50" />;
    if (message.status === 'Delivered')
      return <CheckCheck className="w-3.5 h-3.5 text-[#7D303C]/50 dark:text-rose-200/50" />;
    if (message.status === 'Failed')
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onRetry?.(message); }}
          className="flex items-center gap-0.5 text-rose-500 font-bold text-[10px] hover:underline"
          title="Failed. Tap to retry."
        >
          <AlertCircle className="w-3 h-3" />
          <span>Retry</span>
        </button>
      );
    return <CheckCheck className="w-3.5 h-3.5 text-[#C95565] dark:text-rose-400" />;
  };

  /* ── Document icon ─────────────────────────────────────────────── */
  const getDocIcon = (cat: string) => {
    if (cat === 'pdf' || cat === 'word') return <FileText className="w-5 h-5 text-[#C95565]" />;
    if (cat === 'excel') return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (cat === 'code' || cat === 'text') return <FileCode className="w-5 h-5 text-amber-500" />;
    if (cat === 'archive') return <FileArchive className="w-5 h-5 text-purple-500" />;
    return <File className="w-5 h-5 text-stone-400" />;
  };

  /* ── Bubble corner radius ──────────────────────────────────────── */
  // Connected bubbles: top corner nearest sender is squared off on consecutive messages
  const getBubbleRadius = () => {
    const base = 'rounded-3xl';
    if (!isConsecutive && isLastInGroup) return base; // standalone bubble — fully round
    if (isMine) {
      if (isConsecutive && isLastInGroup) return 'rounded-3xl rounded-tr-lg'; // last in cluster sent
      if (isConsecutive && !isLastInGroup) return 'rounded-3xl rounded-tr-lg rounded-br-lg'; // mid cluster sent
      if (!isConsecutive && !isLastInGroup) return 'rounded-3xl rounded-br-lg'; // first in cluster sent
    } else {
      if (isConsecutive && isLastInGroup) return 'rounded-3xl rounded-tl-lg'; // last in cluster recv
      if (isConsecutive && !isLastInGroup) return 'rounded-3xl rounded-tl-lg rounded-bl-lg'; // mid cluster recv
      if (!isConsecutive && !isLastInGroup) return 'rounded-3xl rounded-bl-lg'; // first in cluster recv
    }
    return base;
  };

  /* ══════════════════════════════════════════════════════════════
     SYSTEM MESSAGE (call / event pill)
  ══════════════════════════════════════════════════════════════ */
  if (isSystemMsg) {
    const t = message.content.toLowerCase();
    const isCall = t.includes('call');
    const isMissed = t.includes('missed');
    const isDeclined = t.includes('declined');
    const isEnded = t.includes('ended');
    const isBusy = t.includes('busy');
    const isVideo = t.includes('video');

    const handleRedial = (e: React.MouseEvent) => {
      e.stopPropagation();
      const partnerId = isMine ? message.receiver_id : message.sender_id;
      if (currentUser && partnerId) {
        useCallStore.getState().startCall(currentUser.id, partnerId, isVideo ? 'video' : 'audio');
      }
    };

    return (
      <div className="flex justify-center my-1.5 select-none">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
            isMissed
              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60'
              : isDeclined || isBusy
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60'
              : isEnded
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-stone-100/80 dark:bg-stone-800/80 text-stone-500 dark:text-stone-400 border-stone-200/50 dark:border-stone-700/50'
          }`}
        >
          {isMissed ? (
            <PhoneMissed className="w-3.5 h-3.5 flex-shrink-0" />
          ) : isDeclined || isBusy ? (
            <PhoneOff className="w-3.5 h-3.5 flex-shrink-0" />
          ) : isEnded ? (
            <PhoneCall className="w-3.5 h-3.5 flex-shrink-0" />
          ) : isCall ? (
            isVideo ? <Video className="w-3.5 h-3.5 flex-shrink-0" /> : <Phone className="w-3.5 h-3.5 flex-shrink-0" />
          ) : null}

          <span className="leading-none">{message.content}</span>
          <span className="opacity-50 ml-0.5">{formatMessageTime(message.created_at)}</span>

          {isCall && (
            <button
              onClick={handleRedial}
              className="ml-0.5 p-0.5 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-all active-scale"
              title="Call back"
            >
              {isVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     REGULAR MESSAGE BUBBLE
  ══════════════════════════════════════════════════════════════ */
  const fileCategory = getFileCategory(message.content);
  const verticalMargin = isConsecutive ? 'mb-0.5' : 'mb-2';

  return (
    <motion.div
      id={`msg-${message.local_uuid}`}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.34, 1.2, 0.64, 1] }}
      drag={onSwipeToReply ? 'x' : false}
      dragConstraints={{ left: 0, right: 55 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 38 && onSwipeToReply) onSwipeToReply(message);
      }}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(message); }}
      className={`flex flex-col relative max-w-[72%] sm:max-w-[65%] ${
        isMine ? 'ml-auto items-end' : 'mr-auto items-start'
      } ${verticalMargin} ${hasReactions ? 'mb-5' : ''}`}
    >
      {/* Pinned / Starred badge */}
      {(message.pinned || message.starred) && (
        <div className="flex items-center gap-1 text-[10px] text-stone-400 mb-0.5 px-1.5">
          {message.pinned && <Pin className="w-2.5 h-2.5 text-[#C95565]" />}
          {message.starred && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />}
        </div>
      )}

      {/* ── Bubble ─────────────────────────────────────────────── */}
      <div
        onClick={() => onLongPress(message)}
        className={`relative cursor-pointer select-none transition-all duration-150 active:brightness-95 ${getBubbleRadius()} ${
          isMediaOnly
            ? 'overflow-hidden p-0'
            : `px-3.5 py-2 ${isMine ? 'bubble-shadow-sent' : 'bubble-shadow-recv'}`
        } ${
          isMine
            ? `${isMediaOnly ? '' : 'bg-[var(--bubble-sent)] text-[var(--bubble-sent-text)]'}`
            : `${isMediaOnly ? '' : 'bg-[var(--bubble-received)] text-[var(--bubble-received-text)]'} ${isMediaOnly ? '' : 'border border-stone-100/80 dark:border-stone-700/50'}`
        } ${message.deleted ? 'italic opacity-60' : ''}`}
      >
        {/* Reply reference */}
        {message.reply_to_msg && !message.deleted && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (onJumpToOriginal && message.reply_to) onJumpToOriginal(message.reply_to);
            }}
            className={`mb-2 pl-2.5 pr-1 py-1.5 rounded-xl border-l-2 border-[#C95565] cursor-pointer hover:opacity-80 active-scale ${
              isMine
                ? 'bg-black/10 dark:bg-black/20'
                : 'bg-stone-100/80 dark:bg-stone-700/50'
            }`}
          >
            <p className="font-bold text-[10px] text-[#C95565] flex items-center gap-1 mb-0.5">
              {getReplyIcon(message.reply_to_msg.message_type)}
              {message.reply_to_msg.sender_name}
            </p>
            <p className="text-[11px] leading-snug line-clamp-2 text-stone-600 dark:text-stone-300 opacity-90">
              {message.reply_to_msg.content}
            </p>
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────── */}
        {isDocumentMsg && !message.deleted ? (
          <div
            onClick={(e) => { e.stopPropagation(); onMediaClick?.(message); }}
            className="flex items-center gap-2.5 py-0.5 pr-1 max-w-[240px] cursor-pointer hover:opacity-90 active-scale"
          >
            <div className="p-2 rounded-xl bg-white/60 dark:bg-stone-700/60 flex-shrink-0">
              {getDocIcon(fileCategory)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">Document</p>
              <p className="text-[10px] opacity-60 uppercase font-semibold mt-0.5">
                {getFileExtensionLabel(message.content)} File
              </p>
            </div>
            <a
              href={message.content}
              download="attachment"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-full bg-white/40 dark:bg-stone-700/40 hover:opacity-80"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : isVideoMsg && !message.deleted ? (
          <div
            onClick={(e) => { e.stopPropagation(); onMediaClick?.(message); }}
            className={`cursor-pointer group relative bg-black ${isMediaOnly ? '' : 'my-1 rounded-2xl overflow-hidden'}`}
          >
            <video
              src={message.content}
              className={`w-full h-auto max-h-56 object-cover ${isMediaOnly ? '' : 'rounded-2xl'} opacity-90 group-hover:opacity-100 transition-opacity`}
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Play className="w-5 h-5 fill-white ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/55 rounded text-[9px] text-white font-bold backdrop-blur-xs flex items-center gap-0.5">
              <Video className="w-2.5 h-2.5" />
              <span>Video</span>
            </div>
          </div>
        ) : isImageMsg && !message.deleted ? (
          <div
            onClick={(e) => { e.stopPropagation(); onMediaClick?.(message); }}
            className={`cursor-pointer group relative ${isMediaOnly ? '' : 'my-1 rounded-2xl overflow-hidden'}`}
          >
            <img
              src={message.content}
              alt="Shared image"
              className={`w-full h-auto max-h-56 object-cover ${isMediaOnly ? '' : 'rounded-2xl'} group-hover:brightness-95 transition-all`}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-2xl flex items-end justify-end p-1.5 opacity-0 group-hover:opacity-100">
              <span className="text-white text-[10px] font-bold px-2 py-0.5 bg-black/40 rounded-full backdrop-blur-sm">
                View
              </span>
            </div>
          </div>
        ) : isVoiceNote && !message.deleted ? (
          <div className="py-0.5">
            <AudioPlayer id={message.local_uuid} src={message.content} />
          </div>
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.deleted ? (
              <span className="italic opacity-60">This message was deleted</span>
            ) : (
              message.content
            )}
          </p>
        )}

        {/* ── Timestamp + Status ───────────────────────────────── */}
        {!isMediaOnly && (
          <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-end'}`}>
            {message.edited && (
              <span className="text-[9px] opacity-50 italic">edited</span>
            )}
            <span className={`text-[10px] leading-none ${
              isMine ? 'text-[#7D303C]/60 dark:text-rose-100/40' : 'text-stone-400/80'
            }`}>
              {formatMessageTime(message.created_at)}
            </span>
            {renderStatus()}
          </div>
        )}

        {/* Timestamp overlay for media-only bubbles */}
        {isMediaOnly && (
          <div className={`absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm`}>
            <span className="text-[9px] text-white/90 leading-none">
              {formatMessageTime(message.created_at)}
            </span>
            {isMine && <span className="text-white/80">{renderStatus()}</span>}
          </div>
        )}

        {/* ── Reactions pill ───────────────────────────────────── */}
        {hasReactions && (
          <div
            onClick={(e) => { e.stopPropagation(); onReactionClick?.(message); }}
            className={`absolute -bottom-4 ${isMine ? 'right-2' : 'left-2'} flex items-center gap-1 px-2 py-0.5 rounded-full shadow-md text-xs cursor-pointer active-scale z-20 border transition-all ${
              hasUserReacted
                ? 'bg-rose-50 dark:bg-[#3D1A23] border-[#C95565]/60 text-[#C95565]'
                : 'bg-white dark:bg-[#1E1D24] border-stone-200/80 dark:border-stone-700'
            }`}
          >
            {message.reactions!.map((r) => (
              <span key={r.id || r.emoji} className="text-xs leading-none">{r.emoji}</span>
            ))}
            {message.reactions!.length > 1 && (
              <span className="text-[9px] font-bold opacity-70">{message.reactions!.length}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
