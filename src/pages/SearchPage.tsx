import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ChevronLeft, X } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from '../components/ui/Avatar';
import { formatDateSeparator, formatMessageTime } from '../utils/date';
import { EmptyState } from '../components/ui/EmptyState';

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'media' | 'links' | 'files'>('messages');
  const messages = useChatStore((state) => state.messages);
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());

  const filteredMessages = query.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(query.toLowerCase()))
    : messages;

  const highlightMatch = (text: string, search: string) => {
    if (!search.trim()) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 dark:bg-amber-800 text-stone-900 dark:text-white rounded px-0.5 font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FDF8F6] dark:bg-[#16151A] pb-20">
      {/* Search Header */}
      <div className="p-4 bg-white dark:bg-[#1E1D24] shadow-soft border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/chat')}
            className="p-1 rounded-full text-stone-600 dark:text-stone-300"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 relative flex items-center">
            <SearchIcon className="w-4 h-4 text-stone-400 absolute left-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-stone-100 dark:bg-[#16151A] text-stone-900 dark:text-stone-100 text-sm pl-10 pr-9 py-2 rounded-full border border-transparent focus:outline-none focus:border-[#C95565]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => navigate('/chat')}
            className="text-xs font-bold text-[#C95565] px-1"
          >
            Cancel
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-stone-100 dark:border-stone-800">
          {(['messages', 'media', 'links', 'files'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold capitalize transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-[#C95565] text-[#C95565]'
                  : 'border-transparent text-stone-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Results Container */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <EmptyState
            title="No matching messages found"
            description="Try searching for another word or phrase in your private chat."
          />
        ) : (
          filteredMessages.map((msg) => {
            const isUserSelf = msg.sender_id === currentUser?.id;
            const senderName = isUserSelf
              ? 'You'
              : currentUser?.nickname || partnerUser.display_name;
            const avatar = isUserSelf ? currentUser?.avatar_url : partnerUser.avatar_url;

            return (
              <div
                key={msg.local_uuid || msg.id}
                onClick={() => navigate('/chat')}
                className="bg-white dark:bg-[#1E1D24] p-3.5 rounded-2xl shadow-soft border border-stone-100 dark:border-stone-800/80 flex items-start gap-3 cursor-pointer active-scale"
              >
                <Avatar src={avatar} name={senderName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {senderName}
                    </h4>
                    <span className="text-[10px] text-stone-400">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">
                    {highlightMatch(msg.content, query)}
                  </p>
                  <span className="inline-block mt-1 text-[10px] text-stone-400">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SearchPage;
