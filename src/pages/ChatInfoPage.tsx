import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Phone,
  Video,
  Search,
  MoreHorizontal,
  Image,
  Star,
  Pin,
  Palette,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePresence } from '../hooks/usePresence';
import { useChatStore } from '../store/useChatStore';
import { Avatar } from '../components/ui/Avatar';
import { Switch } from '../components/ui/Switch';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';

const ChatInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const { subtext, partnerPresence } = usePresence();
  const messages = useChatStore((state) => state.messages);
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotificationsEnabled);
  const addToast = useUIStore((state) => state.addToast);

  const partnerDisplayName = currentUser?.nickname || partnerUser.display_name;
  const starredCount = messages.filter((m) => m.starred).length;
  const pinnedCount = messages.filter((m) => m.pinned).length;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FDF8F6] dark:bg-[#16151A] pb-20">
      {/* Header Bar */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white dark:bg-stone-800 shadow-soft text-stone-700 dark:text-stone-200"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Chat Info</h2>
        <div className="w-9" />
      </div>

      {/* Profile Header Hero */}
      <div className="flex flex-col items-center p-6 text-center">
        <Avatar
          src={partnerUser.avatar_url}
          name={partnerDisplayName}
          size="xl"
          isOnline={partnerPresence.online}
          className="mb-4"
        />
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-1">
          {partnerDisplayName}
        </h1>
        <p className="text-xs font-semibold text-[#C95565] mb-6">{subtext}</p>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => addToast('Voice calling coming soon ❤️', 'info')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-[#1E1D24] shadow-soft border border-stone-100 dark:border-stone-800 w-16 active-scale"
          >
            <Phone className="w-5 h-5 text-[#C95565]" />
            <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Call</span>
          </button>
          <button
            onClick={() => addToast('Video calling coming soon ❤️', 'info')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-[#1E1D24] shadow-soft border border-stone-100 dark:border-stone-800 w-16 active-scale"
          >
            <Video className="w-5 h-5 text-[#C95565]" />
            <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Video</span>
          </button>
          <button
            onClick={() => navigate('/search')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-[#1E1D24] shadow-soft border border-stone-100 dark:border-stone-800 w-16 active-scale"
          >
            <Search className="w-5 h-5 text-[#C95565]" />
            <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Search</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-[#1E1D24] shadow-soft border border-stone-100 dark:border-stone-800 w-16 active-scale"
          >
            <MoreHorizontal className="w-5 h-5 text-[#C95565]" />
            <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">More</span>
          </button>
        </div>
      </div>

      {/* Settings Items Group */}
      <div className="px-4 space-y-3">
        <div className="bg-white dark:bg-[#1E1D24] rounded-3xl p-2 shadow-soft border border-stone-100 dark:border-stone-800/80 divide-y divide-stone-100 dark:divide-stone-800">
          <button
            onClick={() => navigate('/search')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-[#C95565]">
                <Image className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Media, Links and Docs</span>
            </div>
            <div className="flex items-center gap-1 text-stone-400">
              <span className="text-xs font-semibold">120</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => navigate('/search?tab=starred')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
                <Star className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Starred Messages</span>
            </div>
            <div className="flex items-center gap-1 text-stone-400">
              <span className="text-xs font-semibold">{starredCount || 25}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => navigate('/search?tab=pinned')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FCE8EC] dark:bg-[#4A1D28] text-[#C95565]">
                <Pin className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Pinned Messages</span>
            </div>
            <div className="flex items-center gap-1 text-stone-400">
              <span className="text-xs font-semibold">{pinnedCount || 8}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-500">
                <Palette className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Chat Wallpaper</span>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </button>

          <div className="w-full flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Notifications</span>
            </div>
            <Switch checked={notificationsEnabled} onChange={setNotificationsEnabled} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInfoPage;
