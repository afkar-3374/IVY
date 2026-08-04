import React from 'react';
import { X, Send } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { Avatar } from '../ui/Avatar';
import type { Message } from '../../types';

interface ForwardMessageModalProps {
  isOpen: boolean;
  message: Message | null;
  onClose: () => void;
  onForwardSuccess?: () => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  message,
  onClose,
  onForwardSuccess,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const sendMessage = useChatStore((state) => state.sendMessage);

  if (!isOpen || !message || !currentUser) return null;

  const handleForward = async () => {
    await sendMessage(currentUser.id, partnerUser.id, message.content, message.message_type);
    if (onForwardSuccess) onForwardSuccess();
    onClose();
  };

  const partnerDisplayName = currentUser.nickname || partnerUser.display_name;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1E1D24] rounded-2xl p-5 w-full max-w-sm shadow-soft border border-stone-100 dark:border-stone-800 animate-scaleUp">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Forward Message</h3>
          <button onClick={onClose} className="p-1 rounded-full text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snippet Preview */}
        <div className="my-4 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-100 dark:border-stone-700/50">
          <span className="text-[10px] font-bold text-[#C95565] uppercase tracking-wider block mb-1">
            Message Preview
          </span>
          <p className="text-xs text-stone-700 dark:text-stone-300 italic truncate">{message.content}</p>
        </div>

        {/* Partner Selection Row */}
        <div className="flex items-center justify-between p-3 bg-stone-100/70 dark:bg-stone-800/40 rounded-xl mb-5">
          <div className="flex items-center gap-3">
            <Avatar src={partnerUser.avatar_url} name={partnerDisplayName} size="sm" />
            <div>
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100">{partnerDisplayName}</p>
              <p className="text-[11px] text-stone-400">Direct Chat</p>
            </div>
          </div>
          <button
            onClick={handleForward}
            className="px-3.5 py-1.5 rounded-full bg-[#C95565] text-white font-semibold text-xs flex items-center gap-1.5 shadow-soft active-scale hover:bg-[#b04554]"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
