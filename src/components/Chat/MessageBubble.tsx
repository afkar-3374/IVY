import React from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCheck, Clock, FileText, Play, Pin, Star, CornerDownLeft } from 'lucide-react';
import type { Message } from '../../types';
import { formatMessageTime } from '../../utils/date';
import { isMessageFromUser } from '../../utils/message';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';

interface MessageBubbleProps {
  message: Message;
  onLongPress: (msg: Message) => void;
  onReactionClick?: (msg: Message) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onLongPress,
  onReactionClick,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const isMine = currentUser ? isMessageFromUser(message, currentUser.id) : false;

  const renderStatus = () => {
    if (!isMine) return null;
    if (message.status === 'Sending' || message.status === 'Queued') {
      return <Clock className="w-3 h-3 text-stone-400 animate-pulse" />;
    }
    if (message.status === 'Sent') {
      return <Check className="w-3.5 h-3.5 text-stone-400" />;
    }
    if (message.status === 'Delivered') {
      return <CheckCheck className="w-3.5 h-3.5 text-stone-400" />;
    }
    // Read status
    return <CheckCheck className="w-3.5 h-3.5 text-[#C95565] dark:text-rose-400" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col my-1 max-w-[85%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
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
        className={`relative px-4 py-2.5 rounded-3xl text-sm shadow-soft transition-all duration-200 cursor-pointer active-scale select-none ${
          isMine
            ? 'bg-[#FCE8EC] text-[#501C25] dark:bg-[#4A1D28] dark:text-[#FCE8EC] rounded-tr-md'
            : 'bg-white text-stone-900 dark:bg-[#28262E] dark:text-stone-100 rounded-tl-md border border-stone-100 dark:border-stone-800'
        } ${message.deleted ? 'italic opacity-70' : ''}`}
      >
        {/* Reply Reference Box */}
        {message.reply_to_msg && !message.deleted && (
          <div
            className={`mb-2 p-2 rounded-2xl text-xs border-l-2 ${
              isMine
                ? 'bg-white/60 dark:bg-black/20 border-[#C95565]'
                : 'bg-stone-100 dark:bg-stone-800/80 border-[#C95565]'
            }`}
          >
            <p className="font-bold text-[11px] text-[#C95565] flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
              <span>{message.reply_to_msg.sender_name}</span>
            </p>
            <p className="truncate text-stone-600 dark:text-stone-300 text-[11px]">
              {message.reply_to_msg.content}
            </p>
          </div>
        )}

        {/* Voice Note Player Preview */}
        {message.message_type === 'voice' && !message.deleted && (
          <div className="flex items-center gap-3 py-1">
            <button className="w-8 h-8 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft">
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </button>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-0.5 h-4">
                {[40, 70, 30, 90, 60, 80, 40, 60, 90, 50, 30, 70, 40].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#C95565]/60 rounded-full"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400">0:18</span>
            </div>
          </div>
        )}

        {/* Attachment Document Preview Card */}
        {message.message_type === 'document' && !message.deleted && (
          <div className="flex items-center gap-3 p-2 bg-white/70 dark:bg-stone-800/60 rounded-2xl mb-1 border border-stone-200/60 dark:border-stone-700/40">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-[#C95565] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-stone-900 dark:text-stone-100">Love Letter.pdf</p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400">2.4 MB • PDF</p>
            </div>
          </div>
        )}

        {/* Photo Image Preview */}
        {message.message_type === 'image' && !message.deleted && (
          <div className="mb-2 rounded-2xl overflow-hidden shadow-soft max-w-xs">
            <img
              src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80"
              alt="Sunset preview"
              className="w-full h-44 object-cover"
            />
          </div>
        )}

        {/* Text Content */}
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>

        {/* Timestamp & Status Footer */}
        <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMine ? 'text-[#7D303C] dark:text-rose-200/70' : 'text-stone-400 dark:text-stone-400'}`}>
          {message.edited && <span>(edited)</span>}
          <span>{formatMessageTime(message.created_at)}</span>
          {renderStatus()}
        </div>
      </div>

      {/* Reactions Pill Badge */}
      {message.reactions && message.reactions.length > 0 && (
        <div
          onClick={() => onReactionClick && onReactionClick(message)}
          className="flex items-center gap-1 -mt-2.5 px-2 py-0.5 bg-white dark:bg-[#1E1D24] rounded-full shadow-soft border border-stone-200 dark:border-stone-700 text-xs cursor-pointer active-scale z-10"
        >
          {message.reactions.map((r) => (
            <span key={r.id}>{r.emoji}</span>
          ))}
          {message.reactions.length > 1 && (
            <span className="text-[10px] font-bold text-stone-500">{message.reactions.length}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};
