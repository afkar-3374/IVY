import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Check, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useSettingsStore } from '../store/useSettingsStore';
import { WALLPAPER_PRESETS } from '../utils/constants';
import { useUIStore } from '../store/useUIStore';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const updateCurrentUser = useAuthStore((state) => state.updateCurrentUser);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const setWallpaper = useSettingsStore((state) => state.setWallpaper);
  const addToast = useUIStore((state) => state.addToast);

  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [about, setAbout] = useState(currentUser?.about || '');
  const [nickname, setNickname] = useState(currentUser?.nickname || '');
  const [avatarDataUrl, setAvatarDataUrl] = useState(currentUser?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('Image size should be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAvatarDataUrl(result);
        addToast('Avatar photo updated from device', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarDataUrl('');
    addToast('Avatar removed', 'info');
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateCurrentUser({
      display_name: displayName,
      about,
      nickname,
      avatar_url: avatarDataUrl,
    });
    setIsSaving(false);
    addToast('Profile updated successfully ❤️', 'success');
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#FDF8F6] dark:bg-[#16151A] pb-20">
      {/* Top Bar */}
      <div className="p-4 flex items-center justify-between bg-white dark:bg-[#1E1D24] shadow-soft border-b border-stone-100 dark:border-stone-800">
        <button
          onClick={() => navigate('/settings')}
          className="p-1 text-stone-600 dark:text-stone-300"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Profile</h2>
        <Button size="sm" onClick={handleSave} isLoading={isSaving}>
          Save
        </Button>
      </div>

      <div className="p-6 space-y-6 max-w-sm mx-auto w-full">
        {/* Device Photo Avatar Upload Container */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar src={avatarDataUrl} name={displayName} size="xl" />
            
            {/* Hidden File Input for Device Photo */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileSelect}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2.5 bg-[#C95565] text-white rounded-full shadow-soft active-scale hover:bg-[#B34757]"
              title="Upload photo from device"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-[#C95565] hover:underline"
            >
              Choose from device
            </button>
            {avatarDataUrl && (
              <button
                onClick={handleRemoveAvatar}
                className="text-xs font-semibold text-rose-500 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>

        {/* Inputs Form */}
        <div className="space-y-4 bg-white dark:bg-[#1E1D24] p-5 rounded-3xl shadow-soft border border-stone-100 dark:border-stone-800">
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />

          <Input
            label="About"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Short status bio"
          />

          <Input
            label="Nickname for Partner"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. My Princess ❤️"
          />
        </div>

        {/* Theme Selector Card */}
        <div className="bg-white dark:bg-[#1E1D24] p-5 rounded-3xl shadow-soft border border-stone-100 dark:border-stone-800">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-3">
            Theme Preference
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTheme('rose')}
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                theme === 'rose'
                  ? 'border-[#C95565] bg-[#FCE8EC] text-[#C95565]'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              <span>Soft Rose</span>
              {theme === 'rose' && <Check className="w-4 h-4 text-[#C95565]" />}
            </button>

            <button
              onClick={() => setTheme('midnight')}
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                theme === 'midnight'
                  ? 'border-rose-400 bg-stone-900 text-white'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              <span>Midnight Dark</span>
              {theme === 'midnight' && <Check className="w-4 h-4 text-rose-400" />}
            </button>
          </div>
        </div>

        {/* Wallpaper Selector Card */}
        <div className="bg-white dark:bg-[#1E1D24] p-5 rounded-3xl shadow-soft border border-stone-100 dark:border-stone-800">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-3">
            Chat Wallpaper
          </label>
          <div className="grid grid-cols-2 gap-3">
            {WALLPAPER_PRESETS.map((wp) => (
              <button
                key={wp.id}
                onClick={() => setWallpaper(wp.id as any)}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                  wallpaper === wp.id
                    ? 'border-[#C95565] bg-[#FCE8EC] text-[#C95565]'
                    : 'border-stone-200 text-stone-600'
                }`}
              >
                <span className="truncate">{wp.name}</span>
                {wallpaper === wp.id && <Check className="w-4 h-4 text-[#C95565]" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
