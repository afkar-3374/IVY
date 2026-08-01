import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode, WallpaperPreset } from '../types';

interface SettingsState {
  theme: ThemeMode;
  wallpaper: WallpaperPreset;
  notificationsEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  setWallpaper: (wallpaper: WallpaperPreset) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'rose',
      wallpaper: 'botanical',
      notificationsEnabled: true,

      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          if (theme === 'midnight') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },

      setWallpaper: (wallpaper) => set({ wallpaper }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: 'ivy_settings_preferences',
    }
  )
);
