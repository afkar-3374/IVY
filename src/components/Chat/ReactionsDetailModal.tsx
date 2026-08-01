import React from 'react';
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

  if (!isOpen || !message || !message.reactions || message.reactions.length === 0) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm bg-white dark:bg-[#1E1D24] rounded-3xl p-5 shadow-soft-lg z-10 border border-stone-100 dark:border-stone-800"
        >
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3 mb-4">
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Reactions</h3>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {message.reactions.map((r) => {
              const isUserSelf = r.profile_id === currentUser?.id;
              const name = isUserSelf
                ? 'You'
                : currentUser?.nickname || partnerUser.display_name;
              const avatar = isUserSelf ? currentUser?.avatar_url : partnerUser.avatar_url;

              return (
                <div key={r.id} className="flex items-center justify-between py-1.5">
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
