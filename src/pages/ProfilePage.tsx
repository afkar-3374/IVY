import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Camera,
  Trash2,
  Check,
  User,
  Heart,
  Info,
  Palette,
  Image as ImageIcon,
  Upload,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Avatar } from '../components/ui/Avatar';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';
import type { ThemeMode, WallpaperPreset } from '../types';

// ── Theme Definitions ────────────────────────────────────────────
const THEMES: {
  id: ThemeMode;
  name: string;
  emoji: string;
  accent: string;
  bg: string;
  dark?: boolean;
}[] = [
  { id: 'rose',     name: 'Soft Rose',    emoji: '🌹', accent: '#C95565', bg: 'bg-[#FCE8EC]' },
  { id: 'midnight', name: 'Midnight',     emoji: '🌙', accent: '#A78BFA', bg: 'bg-stone-900', dark: true },
  { id: 'sunset',   name: 'Sunset',       emoji: '🌅', accent: '#F97316', bg: 'bg-amber-50' },
  { id: 'lavender', name: 'Lavender',     emoji: '💜', accent: '#9C6FD6', bg: 'bg-purple-50' },
  { id: 'ocean',    name: 'Deep Ocean',   emoji: '🌊', accent: '#0EA5E9', bg: 'bg-slate-900', dark: true },
  { id: 'forest',   name: 'Forest Night', emoji: '🌲', accent: '#16A34A', bg: 'bg-emerald-950', dark: true },
];

// ── Wallpaper Definitions ────────────────────────────────────────
const WALLPAPERS: {
  id: WallpaperPreset;
  name: string;
  emoji: string;
  preview: string; // Tailwind bg class or gradient
}[] = [
  { id: 'botanical', name: 'Soft Floral',    emoji: '🌸', preview: 'bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50' },
  { id: 'minimal',   name: 'Soft Cream',     emoji: '🤍', preview: 'bg-[#FDF8F6]' },
  { id: 'sunset',    name: 'Warm Sunset',    emoji: '🌅', preview: 'bg-gradient-to-b from-amber-100 via-rose-100 to-pink-200' },
  { id: 'starry',    name: 'Starry Night',   emoji: '✨', preview: 'bg-slate-900' },
  { id: 'blush',     name: 'Blush Gradient', emoji: '💗', preview: 'bg-gradient-to-br from-pink-100 via-rose-100 to-red-50' },
  { id: 'aurora',    name: 'Aurora Dream',   emoji: '🌌', preview: 'bg-gradient-to-br from-violet-900 via-purple-800 to-blue-900' },
];

// ── Section Card ─────────────────────────────────────────────────
const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div className="bg-white dark:bg-[#1E1D24] rounded-3xl shadow-soft border border-stone-100 dark:border-stone-800/80 overflow-hidden">
    <div className="flex items-center gap-2 px-5 pt-5 pb-3">
      <span className="text-[#C95565]">{icon}</span>
      <h3 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest">
        {title}
      </h3>
    </div>
    <div className="px-5 pb-5">{children}</div>
  </div>
);

// ── Editable Field ────────────────────────────────────────────────
const EditableField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, maxLength = 60, multiline }) => (
  <div className="group">
    <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">
      {label}
    </label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={2}
        className="w-full bg-stone-50 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 text-sm px-4 py-2.5 rounded-2xl border border-transparent focus:outline-none focus:border-[#C95565]/40 resize-none transition-colors"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full bg-stone-50 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 text-sm px-4 py-2.5 rounded-2xl border border-transparent focus:outline-none focus:border-[#C95565]/40 transition-colors"
      />
    )}
    <div className="text-right mt-0.5">
      <span className="text-[10px] text-stone-300 dark:text-stone-600">
        {value.length}/{maxLength}
      </span>
    </div>
  </div>
);

// ── Main ProfilePage ──────────────────────────────────────────────
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const updateCurrentUser = useAuthStore((state) => state.updateCurrentUser);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const setWallpaper = useSettingsStore((state) => state.setWallpaper);
  const setCustomWallpaper = useSettingsStore((state) => state.setCustomWallpaper);
  const customWallpaperUrl = useSettingsStore((state) => state.customWallpaperUrl);
  const addToast = useUIStore((state) => state.addToast);

  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [about, setAbout] = useState(currentUser?.about || '');
  const [nickname, setNickname] = useState(currentUser?.nickname || '');
  const [avatarDataUrl, setAvatarDataUrl] = useState(currentUser?.avatar_url || '');
  const [isSaving, setIsSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // ── Avatar ──────────────────────────────────────────────────────
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast('Photo must be less than 5 MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setAvatarDataUrl(result);
        addToast('Photo updated ❤️', 'success');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Custom Wallpaper ────────────────────────────────────────────
  const handleWallpaperImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      addToast('Wallpaper photo must be less than 10 MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setCustomWallpaper(result);
        addToast('Custom wallpaper set ✨', 'success');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Save Profile ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!displayName.trim()) {
      addToast('Display name cannot be empty', 'error');
      return;
    }
    setIsSaving(true);
    await updateCurrentUser({
      display_name: displayName.trim(),
      about: about.trim(),
      nickname: nickname.trim(),
      avatar_url: avatarDataUrl,
    });
    setIsSaving(false);
    addToast('Profile saved ❤️', 'success');
  };

  const activeTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-stone-50 dark:bg-[#16151A] pb-24">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1E1D24]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-stone-100 dark:border-stone-800 shadow-soft">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 active-scale"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Edit Profile</h2>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all active-scale ${
            isSaving
              ? 'bg-stone-200 dark:bg-stone-700 text-stone-400'
              : 'bg-[#C95565] text-white shadow-soft hover:bg-[#B34757]'
          }`}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">

        {/* ── Avatar Card ── */}
        <div className="bg-white dark:bg-[#1E1D24] rounded-3xl shadow-soft border border-stone-100 dark:border-stone-800/80 p-6 flex flex-col items-center">
          <div className="relative mb-4">
            <Avatar src={avatarDataUrl} name={displayName || 'Ivy'} size="xl" />
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2.5 bg-[#C95565] text-white rounded-full shadow-soft active-scale hover:bg-[#B34757]"
              title="Upload profile photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <input
            type="file"
            ref={avatarInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelect}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="text-xs font-bold text-[#C95565] hover:underline active-scale"
            >
              Choose from gallery
            </button>
            {avatarDataUrl && (
              <button
                onClick={() => { setAvatarDataUrl(''); addToast('Photo removed', 'info'); }}
                className="text-xs font-semibold text-stone-400 hover:text-rose-500 flex items-center gap-1 active-scale"
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </button>
            )}
          </div>
        </div>

        {/* ── Profile Fields ── */}
        <SectionCard title="Your Info" icon={<User className="w-4 h-4" />}>
          <div className="space-y-4">
            <EditableField
              label="Display Name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Your real name"
              maxLength={40}
            />
            <EditableField
              label="About"
              value={about}
              onChange={setAbout}
              placeholder="A short status or bio…"
              maxLength={80}
              multiline
            />
            <EditableField
              label="Nickname for Partner"
              value={nickname}
              onChange={setNickname}
              placeholder="e.g. My Princess ❤️  or  My Hero ❤️"
              maxLength={40}
            />
            <p className="text-[10px] text-stone-400 dark:text-stone-500 italic">
              Your partner will see this nickname as their name in the app.
            </p>
          </div>
        </SectionCard>

        {/* ── Theme Selector ── */}
        <SectionCard title="Theme" icon={<Palette className="w-4 h-4" />}>
          <div className="grid grid-cols-3 gap-2.5">
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all active-scale ${
                    isActive
                      ? 'border-[#C95565] shadow-soft'
                      : 'border-stone-100 dark:border-stone-800 hover:border-stone-200'
                  } ${t.dark ? 'bg-stone-900 text-white' : 'bg-stone-50 dark:bg-stone-800/50 text-stone-800 dark:text-stone-200'}`}
                >
                  {/* Color swatch */}
                  <div
                    className="w-7 h-7 rounded-full shadow-inner"
                    style={{ background: t.accent }}
                  />
                  <span className="text-[11px] font-bold leading-tight text-center">
                    {t.emoji} {t.name}
                  </span>
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#C95565] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                  {t.dark && (
                    <span className="text-[9px] font-semibold text-stone-400">Dark</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-stone-400 mt-3 italic">
            Dark themes automatically switch the app to dark mode.
          </p>
        </SectionCard>

        {/* ── Wallpaper Selector ── */}
        <SectionCard title="Chat Wallpaper" icon={<ImageIcon className="w-4 h-4" />}>
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            {WALLPAPERS.map((wp) => {
              const isActive = wallpaper === wp.id;
              return (
                <button
                  key={wp.id}
                  onClick={() => setWallpaper(wp.id as WallpaperPreset)}
                  className={`relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all active-scale aspect-[3/4] ${
                    isActive ? 'border-[#C95565] shadow-soft' : 'border-stone-100 dark:border-stone-800'
                  }`}
                >
                  {/* Preview swatch */}
                  <div className={`flex-1 ${wp.preview} flex items-center justify-center text-lg`}>
                    {wp.emoji}
                  </div>
                  <div className="py-1.5 px-1 bg-white dark:bg-stone-900 text-center">
                    <span className="text-[10px] font-bold text-stone-700 dark:text-stone-200 leading-tight block truncate px-1">
                      {wp.name}
                    </span>
                  </div>
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#C95565] flex items-center justify-center shadow">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </button>
              );
            })}

            {/* Custom Gallery Wallpaper Button */}
            <button
              onClick={() => wallpaperInputRef.current?.click()}
              className={`relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all active-scale aspect-[3/4] ${
                wallpaper === 'custom'
                  ? 'border-[#C95565] shadow-soft'
                  : 'border-dashed border-stone-200 dark:border-stone-700'
              }`}
            >
              {wallpaper === 'custom' && customWallpaperUrl ? (
                <>
                  <img
                    src={customWallpaperUrl}
                    alt="Custom wallpaper"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center">
                    <Upload className="w-5 h-5 text-white mb-1" />
                    <span className="text-[10px] font-bold text-white">Change</span>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-1 bg-stone-50 dark:bg-stone-800/40">
                  <Upload className="w-5 h-5 text-[#C95565]" />
                  <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 px-1 text-center leading-tight">
                    Upload from gallery
                  </span>
                </div>
              )}
              {wallpaper === 'custom' && (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#C95565] flex items-center justify-center shadow z-10">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}
            </button>
          </div>

          <input
            type="file"
            ref={wallpaperInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleWallpaperImageSelect}
          />

          <p className="text-[10px] text-stone-400 italic mt-1">
            Upload any photo from your gallery as the chat background.
          </p>
        </SectionCard>

        {/* ── Save Button (Bottom) ── */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-all active-scale shadow-soft ${
            isSaving
              ? 'bg-stone-200 dark:bg-stone-700 text-stone-400'
              : 'bg-[#C95565] text-white hover:bg-[#B34757]'
          }`}
        >
          {isSaving ? 'Saving…' : '✨  Save Profile'}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
