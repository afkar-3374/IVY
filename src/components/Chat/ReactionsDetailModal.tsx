import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Message } from '../../types';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '../../store/useAuthStore';
import { formatMessageTime } from '../../utils/date';

interface ReactionsDetailModalProps {
  isOpen: boolean;
  message: Message | null;
  onClose: () => void;
}

export const ReactionsDetailModal: React.FC<ReactionsDetailModalProps> = ({
  isOpen,
  message,
  onClose,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const [selectedEmojiFilter, setSelectedEmojiFilter] = useState<string>('all');

  if (!isOpen || !message || !message.reactions || message.reactions.length === 0) return null;

  const uniqueEmojis = Array.from(new Set(message.reactions.map((r) => r.emoji)));

  const filteredReactions = selectedEmojiFilter === 'all'
    ? message.reactions
    : message.reactions.filter((r) => r.emoji === selectedEmojiFilter);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Bottom Sheet Modal Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="relative w-full max-w-sm bg-white dark:bg-[#1E1D24] rounded-t-3xl sm:rounded-3xl p-5 shadow-soft-lg z-10 border border-stone-100 dark:border-stone-800 pb-safe"
        >
          {/* Top Grab Handle */}
          <div className="w-12 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto mb-3 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3 mb-3">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Reactions</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Bar */}
          {uniqueEmojis.length > 1 && (
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 border-b border-stone-100 dark:border-stone-800/60">
              <button
                onClick={() => setSelectedEmojiFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  selectedEmojiFilter === 'all'
                    ? 'bg-[#C95565] text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                }`}
              >
                All ({message.reactions.length})
              </button>
              {uniqueEmojis.map((emoji) => {
                const count = message.reactions!.filter((r) => r.emoji === emoji).length;
                return (
                  <button
                    key={emoji}
                    onClick={() => setSelectedEmojiFilter(emoji)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-colors ${
                      selectedEmojiFilter === emoji
                        ? 'bg-[#C95565] text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Reactions List */}
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {filteredReactions.map((r) => {
              const isUserSelf = r.profile_id === currentUser?.id;
              const name = isUserSelf
                ? 'You'
                : currentUser?.nickname || partnerUser.display_name;
              const avatar = isUserSelf ? currentUser?.avatar_url : partnerUser.avatar_url;

              return (
                <div key={r.id || r.emoji} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <Avatar src={avatar} name={name} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-stone-800 dark:text-stone-200">{name}</p>
                      <p className="text-[10px] text-stone-400">{formatMessageTime(r.created_at)}</p>
                    </div>
                  </div>
                  <span className="text-xl">{r.emoji}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
