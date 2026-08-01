import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';

interface EmojiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Frequently Used',
    emojis: ['❤️', '😍', '😂', '🥰', '😘', '🥺', '🌹', '✨', '🙏', '💖', '🔥', '😊', '💕', '🙈'],
  },
  {
    name: 'Smileys & Love',
    emojis: ['😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'],
  },
  {
    name: 'Hearts & Romance',
    emojis: ['❤️', '🩷', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🌹', '🌺', '🌸', '💐'],
  },
  {
    name: 'Gestures',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏'],
  },
];

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="relative w-full max-w-md mx-auto h-[50vh] bg-stone-900 text-white rounded-t-3xl shadow-soft-lg z-10 flex flex-col p-4 pb-safe border-t border-stone-800"
        >
          {/* Header with Search */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search emoji"
                className="w-full bg-stone-800 text-sm pl-9 pr-4 py-2 rounded-full border border-stone-700 focus:outline-none focus:border-[#C95565]"
              />
            </div>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Emoji Grid Container */}
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.name}>
                <h4 className="text-xs font-semibold text-stone-400 mb-2">{cat.name}</h4>
                <div className="grid grid-cols-7 gap-2">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onSelectEmoji(emoji);
                        onClose();
                      }}
                      className="text-2xl hover:scale-125 transition-transform p-1 active-scale rounded-xl hover:bg-stone-800"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
