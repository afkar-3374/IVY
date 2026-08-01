import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Video,
  MoreVertical,
  Plus,
  Smile,
  Mic,
  Send,
  X,
  ChevronLeft,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { usePresence } from '../hooks/usePresence';
import { useInfiniteMessages } from '../hooks/useInfiniteMessages';
import { useTyping } from '../hooks/useTyping';
import { MessageBubble } from '../components/Chat/MessageBubble';
import { MessageActionModal } from '../components/Chat/MessageActionModal';
import { EmojiPickerModal } from '../components/Chat/EmojiPickerModal';
import { ReactionsDetailModal } from '../components/Chat/ReactionsDetailModal';
import { Avatar } from '../components/ui/Avatar';
import { formatDateSeparator } from '../utils/date';
import type { Message } from '../types';
import { useUIStore } from '../store/useUIStore';

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const { subtext, partnerPresence } = usePresence();
  const { messages, isLoadingMessages, loadMoreMessages } = useInfiniteMessages();
  const { triggerTyping } = useTyping();
  const addToast = useUIStore((state) => state.addToast);

  const [inputContent, setInputContent] = useState('');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isReactionsModalOpen, setIsReactionsModalOpen] = useState(false);

  const {
    sendMessage,
    editMessage,
    deleteMessage,
    togglePin,
    toggleStar,
    toggleReaction,
    activeReplyTarget,
    selectedMessage,
    editingMessage,
    setActiveReplyTarget,
    setSelectedMessage,
    setEditingMessage,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !currentUser) return;

    if (editingMessage) {
      await editMessage(editingMessage.local_uuid, inputContent.trim());
      setInputContent('');
      return;
    }

    const text = inputContent.trim();
    setInputContent('');
    await sendMessage(currentUser.id, partnerUser.id, text);
  };

  const handleMessageLongPress = (msg: Message) => {
    setSelectedMessage(msg);
    setIsActionModalOpen(true);
  };

  const handleReactionClick = (msg: Message) => {
    setSelectedMessage(msg);
    setIsReactionsModalOpen(true);
  };

  const partnerDisplayName = currentUser?.nickname || partnerUser.display_name;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#1E1D24]/90 backdrop-blur-md px-4 py-3 border-b border-stone-100 dark:border-stone-800/80 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="p-1 rounded-full text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div
            onClick={() => navigate('/chat/info')}
            className="flex items-center gap-2.5 cursor-pointer active-scale"
          >
            <Avatar
              src={partnerUser.avatar_url}
              name={partnerDisplayName}
              size="md"
              isOnline={partnerPresence.online}
            />
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 leading-tight">
                {partnerDisplayName}
              </h2>
              <p
                className={`text-[11px] font-semibold ${
                  subtext.includes('Typing') || subtext.includes('Recording')
                    ? 'text-[#C95565] animate-pulse font-bold'
                    : 'text-stone-400 dark:text-stone-400'
                }`}
              >
                {subtext}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
          <button
            onClick={() => addToast('Voice calling coming in next update ❤️', 'info')}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 active-scale"
          >
            <Phone className="w-5 h-5 text-[#C95565]" />
          </button>
          <button
            onClick={() => addToast('Video calling coming in next update ❤️', 'info')}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 active-scale"
          >
            <Video className="w-5 h-5 text-[#C95565]" />
          </button>
          <button
            onClick={() => navigate('/chat/info')}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 active-scale"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages Stream Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 pb-24"
      >
        {isLoadingMessages && messages.length === 0 && (
          <div className="text-center py-4 text-xs text-stone-400">Loading messages...</div>
        )}

        {messages.map((msg, idx) => {
          const prevMsg = messages[idx - 1];
          const showDateSeparator =
            !prevMsg ||
            new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

          return (
            <React.Fragment key={msg.local_uuid || msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-3">
                  <span className="px-3 py-1 bg-white/80 dark:bg-stone-800/80 rounded-full text-[11px] font-semibold text-stone-500 dark:text-stone-400 shadow-soft backdrop-blur-sm border border-stone-100 dark:border-stone-700/50">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              <MessageBubble
                message={msg}
                onLongPress={handleMessageLongPress}
                onReactionClick={handleReactionClick}
              />
            </React.Fragment>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Reference Banner */}
      {activeReplyTarget && (
        <div className="bg-white/95 dark:bg-[#1E1D24]/95 px-4 py-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between z-20">
          <div className="border-l-2 border-[#C95565] pl-2 text-xs">
            <span className="font-bold text-[#C95565]">
              Replying to {activeReplyTarget.sender_id === currentUser?.id ? 'Yourself' : partnerDisplayName}
            </span>
            <p className="text-stone-500 truncate max-w-xs">{activeReplyTarget.content}</p>
          </div>
          <button onClick={() => setActiveReplyTarget(null)} className="p-1 text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Input Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto bg-white/95 dark:bg-[#1E1D24]/95 backdrop-blur-md p-3 border-t border-stone-100 dark:border-stone-800 pb-safe">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => addToast('Media sharing ready for storage connection ❤️', 'info')}
            className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 text-[#C95565] flex items-center justify-center flex-shrink-0 active-scale"
          >
            <Plus className="w-5 h-5" />
          </button>

          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={inputContent}
              onChange={(e) => {
                setInputContent(e.target.value);
                triggerTyping();
              }}
              placeholder="Type a message..."
              className="w-full bg-stone-100 dark:bg-[#16151A] text-stone-900 dark:text-stone-100 text-sm px-4 py-2.5 rounded-full border border-transparent focus:outline-none focus:border-[#C95565]/40 pr-10"
            />
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(true)}
              className="absolute right-3 text-stone-400 hover:text-[#C95565]"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {inputContent.trim() ? (
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft active-scale"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => addToast('Recording voice note simulation ❤️', 'info')}
              className="w-10 h-10 rounded-full bg-[#C95565] text-white flex items-center justify-center flex-shrink-0 shadow-soft active-scale"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </form>
      </footer>

      {/* Action Modals */}
      <MessageActionModal
        isOpen={isActionModalOpen}
        message={selectedMessage}
        currentUserId={currentUser?.id || ''}
        onClose={() => setIsActionModalOpen(false)}
        onReactionSelect={(emoji) => {
          if (selectedMessage && currentUser) {
            toggleReaction(selectedMessage.local_uuid, currentUser.id, emoji);
          }
        }}
        onReply={() => selectedMessage && setActiveReplyTarget(selectedMessage)}
        onEdit={() => {
          if (selectedMessage) {
            setEditingMessage(selectedMessage);
            setInputContent(selectedMessage.content);
          }
        }}
        onDelete={() => selectedMessage && deleteMessage(selectedMessage.local_uuid)}
        onCopy={() => {
          if (selectedMessage) {
            navigator.clipboard.writeText(selectedMessage.content);
            addToast('Copied to clipboard', 'info');
          }
        }}
        onToggleStar={() => selectedMessage && toggleStar(selectedMessage.local_uuid)}
        onTogglePin={() => selectedMessage && togglePin(selectedMessage.local_uuid)}
      />

      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        onSelectEmoji={(emoji) => setInputContent((prev) => prev + emoji)}
      />

      <ReactionsDetailModal
        isOpen={isReactionsModalOpen}
        message={selectedMessage}
        onClose={() => setIsReactionsModalOpen(false)}
      />
    </div>
  );
};

export default ChatPage;
