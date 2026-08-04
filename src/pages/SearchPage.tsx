import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, ChevronLeft, X, Pin, Star, Image as ImageIcon, Mic, FileText, Download } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from '../components/ui/Avatar';
import { formatDateSeparator, formatMessageTime } from '../utils/date';
import { EmptyState } from '../components/ui/EmptyState';
import { getFileExtensionLabel } from '../utils/fileIcons';

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'media' | 'files' | 'starred' | 'pinned'>('all');
  const messages = useChatStore((state) => state.messages);
  const setTargetMessageId = useChatStore((state) => state.setTargetMessageId);
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());

  const filteredMessages = messages.filter((m) => {
    const isImage = m.message_type === 'image' || (typeof m.content === 'string' && m.content.startsWith('data:image/'));
    const isVoice = m.message_type === 'voice' || (typeof m.content === 'string' && m.content.startsWith('data:audio/'));
    const isVideo = m.message_type === 'video' || (typeof m.content === 'string' && m.content.startsWith('data:video/'));
    const isDocument = m.message_type === 'document' || m.message_type === 'file' || (!isImage && !isVoice && !isVideo && m.message_type !== 'text' && m.message_type !== 'system');

    if (activeTab === 'media') {
      return isImage || isVoice || isVideo;
    }
    if (activeTab === 'files') {
      return isDocument;
    }
    if (activeTab === 'starred') {
      return m.starred;
    }
    if (activeTab === 'pinned') {
      return m.pinned;
    }

    const matchesQuery = !query.trim() || m.content.toLowerCase().includes(query.toLowerCase());
    return matchesQuery;
  });

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

  const handleSelectMessage = (localUuid: string) => {
    setTargetMessageId(localUuid);
    navigate('/chat');
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FDF8F6] dark:bg-[#16151A] pb-20">
      {/* Search Header */}
      <div className="p-4 bg-white dark:bg-[#1E1D24] shadow-soft border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/chat')}
            className="p-1 rounded-full text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 relative flex items-center">
            <SearchIcon className="w-4 h-4 text-stone-400 absolute left-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chat messages or files..."
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
            className="text-xs font-bold text-[#C95565] px-1 hover:underline"
          >
            Cancel
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-stone-100 dark:border-stone-800 overflow-x-auto">
          {(['all', 'messages', 'media', 'files', 'starred', 'pinned'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 text-xs font-bold capitalize transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab
                  ? 'border-[#C95565] text-[#C95565]'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Results Container */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto max-w-2xl mx-auto w-full">
        {filteredMessages.length === 0 ? (
          <EmptyState
            title="No matching items found"
            description="Try searching for another keyword or check your filter tabs."
          />
        ) : (
          filteredMessages.map((msg) => {
            const isUserSelf = msg.sender_id === currentUser?.id;
            const senderName = isUserSelf
              ? 'You'
              : currentUser?.nickname || partnerUser.display_name;
            const avatar = isUserSelf ? currentUser?.avatar_url : partnerUser.avatar_url;

            const isImage = msg.message_type === 'image' || (typeof msg.content === 'string' && msg.content.startsWith('data:image/'));
            const isVoice = msg.message_type === 'voice' || (typeof msg.content === 'string' && msg.content.startsWith('data:audio/'));
            const isVideo = msg.message_type === 'video' || (typeof msg.content === 'string' && msg.content.startsWith('data:video/'));
            const isDocument = msg.message_type === 'document' || msg.message_type === 'file' || (!isImage && !isVoice && !isVideo && msg.message_type !== 'text' && msg.message_type !== 'system');

            return (
              <div
                key={msg.local_uuid || msg.id}
                onClick={() => handleSelectMessage(msg.local_uuid)}
                className="bg-white dark:bg-[#1E1D24] p-3.5 rounded-2xl shadow-soft border border-stone-100 dark:border-stone-800/80 flex items-start gap-3 cursor-pointer active-scale hover:border-[#C95565]/40 transition-colors"
              >
                <Avatar src={avatar} name={senderName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        {senderName}
                      </h4>
                      {msg.pinned && <Pin className="w-3 h-3 text-[#C95565]" />}
                      {msg.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    </div>
                    <span className="text-[10px] text-stone-400">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>

                  {isDocument ? (
                    <div className="flex items-center justify-between mt-1 p-2 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-700">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <FileText className="w-4 h-4 text-[#C95565] flex-shrink-0" />
                        <span className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                          Document ({getFileExtensionLabel(msg.content)})
                        </span>
                      </div>
                      <a
                        href={msg.content}
                        download="attachment"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-stone-400 hover:text-[#C95565]"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ) : isImage ? (
                    <div className="flex items-center gap-2 mt-1">
                      <img
                        src={msg.content}
                        alt="Media preview"
                        className="w-16 h-16 object-cover rounded-xl border border-stone-200 dark:border-stone-700"
                      />
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-[#C95565]" />
                        Photo Attachment
                      </span>
                    </div>
                  ) : isVoice ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-semibold flex items-center gap-1">
                        <Mic className="w-3.5 h-3.5 text-[#C95565]" />
                        Voice Note
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-700 dark:text-stone-300 line-clamp-2 leading-relaxed">
                      {highlightMatch(msg.content, query)}
                    </p>
                  )}

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
