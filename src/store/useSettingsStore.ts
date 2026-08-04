import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode, WallpaperPreset } from '../types';

interface SettingsState {
  theme: ThemeMode;
  wallpaper: WallpaperPreset;
  customWallpaperUrl: string;
  notificationsEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  setWallpaper: (wallpaper: WallpaperPreset) => void;
  setCustomWallpaper: (dataUrl: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

const DARK_THEMES: ThemeMode[] = ['midnight', 'ocean', 'forest'];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'rose',
      wallpaper: 'botanical',
      customWallpaperUrl: '',
      notificationsEnabled: true,

      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          if (DARK_THEMES.includes(theme)) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },

      setWallpaper: (wallpaper) => set({ wallpaper }),

      setCustomWallpaper: (dataUrl) =>
        set({ customWallpaperUrl: dataUrl, wallpaper: 'custom' }),

      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: 'ivy_settings_preferences',
    }
  )
);
