import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Edit3, Trash2, Copy, Star, Pin, Plus } from 'lucide-react';
import type { Message } from '../../types';
import { QUICK_EMOJIS } from '../../utils/constants';

interface MessageActionModalProps {
  isOpen: boolean;
  message: Message | null;
  currentUserId: string;
  onClose: () => void;
  onReactionSelect: (emoji: string) => void;
  onOpenCustomEmojiPicker: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onToggleStar: () => void;
  onTogglePin: () => void;
}

export const MessageActionModal: React.FC<MessageActionModalProps> = ({
  isOpen,
  message,
  currentUserId,
  onClose,
  onReactionSelect,
  onOpenCustomEmojiPicker,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onToggleStar,
  onTogglePin,
}) => {
  if (!isOpen || !message) return null;

  const isMine = message.sender_id === currentUserId;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="relative w-full max-w-md mx-auto bg-white dark:bg-[#1E1D24] rounded-t-3xl shadow-soft-lg z-10 p-5 pb-safe overflow-hidden border-t border-stone-100 dark:border-stone-800"
        >
          {/* Top Grab Handle */}
          <div className="w-12 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mb-4" />

          {/* Quick Reaction Bar (5 Default Emojis + 1 Choice Custom Plus Button) */}
          <div className="flex items-center justify-around bg-stone-100 dark:bg-stone-800/80 p-2 rounded-full mb-4 shadow-inner">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReactionSelect(emoji);
                  onClose();
                }}
                className="text-2xl hover:scale-125 transition-transform active-scale p-1"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}

            {/* Choice 1 Custom Emoji Picker Button */}
            <button
              onClick={() => {
                onClose();
                onOpenCustomEmojiPicker();
              }}
              className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 flex items-center justify-center hover:scale-110 active-scale shadow-sm"
              title="More Emojis"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Message Content Preview */}
          <div className="p-3 bg-stone-50 dark:bg-stone-900/60 rounded-2xl mb-4 border border-stone-200/50 dark:border-stone-800">
            <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 italic">
              "{message.message_type === 'voice' ? '🎵 Voice Note' : message.content}"
            </p>
          </div>

          {/* Actions List */}
          <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
            <button
              onClick={() => {
                onReply();
                onClose();
              }}
              className="flex items-center gap-3 py-3 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:text-[#C95565] transition-colors"
            >
              <Reply className="w-4 h-4 text-stone-400" />
              <span>Reply</span>
            </button>

            {isMine && !message.deleted && (
              <button
                onClick={() => {
                  onEdit();
                  onClose();
                }}
                className="flex items-center gap-3 py-3 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:text-[#C95565] transition-colors"
              >
                <Edit3 className="w-4 h-4 text-stone-400" />
                <span>Edit</span>
              </button>
            )}

            <button
              onClick={() => {
                onCopy();
                onClose();
              }}
              className="flex items-center gap-3 py-3 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:text-[#C95565] transition-colors"
            >
              <Copy className="w-4 h-4 text-stone-400" />
              <span>Copy</span>
            </button>

            <button
              onClick={() => {
                onToggleStar();
                onClose();
              }}
              className="flex items-center gap-3 py-3 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:text-[#C95565] transition-colors"
            >
              <Star className={`w-4 h-4 ${message.starred ? 'text-amber-500 fill-amber-500' : 'text-stone-400'}`} />
              <span>{message.starred ? 'Unstar' : 'Star'}</span>
            </button>

            <button
              onClick={() => {
                onTogglePin();
                onClose();
              }}
              className="flex items-center gap-3 py-3 text-sm font-semibold text-stone-700 dark:text-stone-200 hover:text-[#C95565] transition-colors"
            >
              <Pin className={`w-4 h-4 ${message.pinned ? 'text-[#C95565]' : 'text-stone-400'}`} />
              <span>{message.pinned ? 'Unpin' : 'Pin'}</span>
            </button>

            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="flex items-center gap-3 py-3 text-sm font-semibold text-rose-600 hover:text-rose-700 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete for everyone</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
