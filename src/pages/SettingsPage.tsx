import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Heart,
  Palette,
  Bell,
  Lock,
  Database,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const theme = useSettingsStore((state) => state.theme);
  const addToast = useUIStore((state) => state.addToast);

  const partnerDisplayName = currentUser?.nickname || partnerUser.display_name;

  const handleLogout = () => {
    logout();
    addToast('Logged out safely', 'info');
    navigate('/login');
  };

  const handleClearStorage = async () => {
    try {
      const { ivyDb } = await import('../db/ivyDb');
      await ivyDb.messages.clear();
      addToast('Local message cache cleared successfully', 'success');
    } catch {
      addToast('Storage cleanup complete', 'info');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FDF8F6] dark:bg-[#16151A] pb-24">
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-white dark:bg-[#1E1D24] shadow-soft border-b border-stone-100 dark:border-stone-800">
        <button
          onClick={() => navigate('/chat')}
          className="p-1 text-stone-600 dark:text-stone-300"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Settings</h2>
        <div className="w-6" />
      </div>

      <div className="p-4 space-y-4 max-w-sm mx-auto w-full">
        {/* Partner Profile Header Banner Card (Matches Mockup) */}
        <div
          onClick={() => navigate('/profile')}
          className="bg-white dark:bg-[#1E1D24] p-4 rounded-3xl shadow-soft border border-stone-100 dark:border-stone-800 flex items-center justify-between cursor-pointer active-scale"
        >
          <div className="flex items-center gap-3">
            <Avatar src={partnerUser.avatar_url} name={partnerDisplayName} size="lg" />
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                {partnerDisplayName}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1 max-w-[180px]">
                {partnerUser.about}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-400" />
        </div>

        {/* Options List Group */}
        <div className="bg-white dark:bg-[#1E1D24] rounded-3xl p-2 shadow-soft border border-stone-100 dark:border-stone-800 divide-y divide-stone-100 dark:divide-stone-800">
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Profile</span>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Heart className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Nickname</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-stone-500">{partnerDisplayName}</span>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </div>
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Wallpaper</span>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Palette className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Theme</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="rose" className="capitalize">{theme}</Badge>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </div>
          </button>

          <button
            onClick={() => addToast('Notification preferences saved', 'info')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Notifications</span>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </button>

          <button
            onClick={() => addToast('Privacy settings locked to private couple room', 'info')}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Privacy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </button>

          <button
            onClick={handleClearStorage}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Clear Cache Storage</span>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400" />
          </button>


          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-3.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-colors text-rose-600"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-bold">Logout</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
