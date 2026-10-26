import React, { useState } from 'react';
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
  Keyboard,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';
import { Switch } from '../components/ui/Switch';
import { notificationService } from '../services/notificationService';
import { PushSetting } from '../components/Couple/PushPrompt';

const AUTO_LOCK_OPTIONS = [
  { seconds: 0, label: 'Immediately' },
  { seconds: 30, label: '30 sec' },
  { seconds: 60, label: '1 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 1800, label: '30 min' },
];

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const partnerUser = useAuthStore((state) => state.getPartnerProfile());
  const theme = useSettingsStore((state) => state.theme);
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const notifyMessages = useSettingsStore((state) => state.notifyMessages);
  const notifyCalls = useSettingsStore((state) => state.notifyCalls);
  const notifySound = useSettingsStore((state) => state.notifySound);
  const notifyVibration = useSettingsStore((state) => state.notifyVibration);
  const dndEnabled = useSettingsStore((state) => state.dndEnabled);
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotificationsEnabled);
  const setNotifyMessages = useSettingsStore((state) => state.setNotifyMessages);
  const setNotifyCalls = useSettingsStore((state) => state.setNotifyCalls);
  const setNotifySound = useSettingsStore((state) => state.setNotifySound);
  const setNotifyVibration = useSettingsStore((state) => state.setNotifyVibration);
  const setDndEnabled = useSettingsStore((state) => state.setDndEnabled);
  const ivyKeyboard = useSettingsStore((state) => state.ivyKeyboard);
  const setIvyKeyboard = useSettingsStore((state) => state.setIvyKeyboard);
  const addToast = useUIStore((state) => state.addToast);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const autoLockSeconds = useSettingsStore((state) => state.autoLockSeconds);
  const setAutoLockSeconds = useSettingsStore((state) => state.setAutoLockSeconds);
  const lock = useAuthStore((state) => state.lock);

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
    <div className="flex-1 flex flex-col min-h-full bg-[#FDF8F6] dark:bg-[#16151A] pb-[calc(7rem+var(--safe-bottom))] lg:pb-8">
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

      <div className="p-4 space-y-4 w-full">
        {/* Partner Profile Header Banner Card (Matches Mockup) */}
        <div
          onClick={() => navigate('/profile')}
          className="bg-white dark:bg-[#1E1D24] p-4 rounded-3xl shadow-soft border border-stone-100 dark:border-stone-800 flex items-center justify-between cursor-pointer active-scale"
        >
          {/* You: tap to edit your profile */}
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={currentUser?.avatar_url} name={currentUser?.display_name} size="lg" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                {currentUser?.display_name}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
                {currentUser?.about || 'Tap to add something about you'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-400 flex-shrink-0" />
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

          <div className="w-full flex items-center justify-between gap-3 p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Keyboard className="w-4 h-4 text-stone-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-800 dark:text-stone-200">Ivy keyboard</p>
                <p className="text-[10px] text-stone-500">{ivyKeyboard ? "Ivy's own keyboard in the chat" : "Typing with your phone's keyboard"}</p>
              </div>
            </div>
            <Switch checked={ivyKeyboard} onChange={setIvyKeyboard} />
          </div>

          <button
            onClick={() => setNotificationsOpen((open) => !open)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Notifications</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${notificationsOpen ? 'rotate-90' : ''}`} />
          </button>

          {notificationsOpen && (
            <div className="px-3.5 pb-3 pt-1 space-y-3 bg-stone-50/70 dark:bg-stone-900/20 rounded-2xl">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-bold">Enable notifications</p><p className="text-[10px] text-stone-500">Alerts when Ivy is not active</p></div>
                <Switch checked={notificationsEnabled} onChange={async (enabled) => { setNotificationsEnabled(enabled); if (enabled) await notificationService.requestPermission(); }} />
              </div>
              <PushSetting />
              <div className="flex items-center justify-between"><span className="text-xs font-semibold">Messages</span><Switch checked={notifyMessages} onChange={setNotifyMessages} disabled={!notificationsEnabled} /></div>
              <div className="flex items-center justify-between"><span className="text-xs font-semibold">Calls</span><Switch checked={notifyCalls} onChange={setNotifyCalls} disabled={!notificationsEnabled} /></div>
              <div className="flex items-center justify-between"><span className="text-xs font-semibold">Sound</span><Switch checked={notifySound} onChange={setNotifySound} disabled={!notificationsEnabled} /></div>
              <div className="flex items-center justify-between"><span className="text-xs font-semibold">Vibration</span><Switch checked={notifyVibration} onChange={setNotifyVibration} disabled={!notificationsEnabled} /></div>
              <div className="flex items-center justify-between"><div><p className="text-xs font-semibold">Do Not Disturb</p><p className="text-[10px] text-stone-500">Keep notifications silent</p></div><Switch checked={dndEnabled} onChange={setDndEnabled} /></div>
            </div>
          )}

          <button
            onClick={() => setPrivacyOpen((open) => !open)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/40 rounded-2xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Privacy</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${privacyOpen ? 'rotate-90' : ''}`} />
          </button>

          {privacyOpen && (
            <div className="px-3.5 pb-3 pt-1 space-y-3 bg-stone-50/70 dark:bg-stone-900/20 rounded-2xl">
              <div>
                <p className="text-xs font-bold">Auto-lock</p>
                <p className="text-[10px] text-stone-500 mb-2">After Ivy has been in the background this long, it opens to the Kitty Timer again</p>
                <div className="flex flex-wrap gap-1.5">
                  {AUTO_LOCK_OPTIONS.map(({ seconds, label }) => (
                    <button
                      key={seconds}
                      onClick={() => setAutoLockSeconds(seconds)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                        autoLockSeconds === seconds
                          ? 'bg-[#C95565] text-white'
                          : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">Lock now</p>
                  <p className="text-[10px] text-stone-500">Hide Ivy behind the Kitty Timer straight away</p>
                </div>
                <button onClick={lock} className="btn-gloss rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Lock
                </button>
              </div>
            </div>
          )}

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
