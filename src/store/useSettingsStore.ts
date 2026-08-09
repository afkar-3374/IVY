import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode, WallpaperPreset } from '../types';
import { notificationService } from '../services/notificationService';

interface SettingsState {
  theme: ThemeMode;
  wallpaper: WallpaperPreset;
  customWallpaperUrl: string;
  // Granular notification preferences
  notificationsEnabled: boolean;
  notifyMessages: boolean;
  notifyCalls: boolean;
  notifySound: boolean;
  notifyVibration: boolean;
  dndEnabled: boolean;

  setTheme: (theme: ThemeMode) => void;
  setWallpaper: (wallpaper: WallpaperPreset) => void;
  setCustomWallpaper: (dataUrl: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setNotifyMessages: (enabled: boolean) => void;
  setNotifyCalls: (enabled: boolean) => void;
  setNotifySound: (enabled: boolean) => void;
  setNotifyVibration: (enabled: boolean) => void;
  setDndEnabled: (enabled: boolean) => void;
}

const DARK_THEMES: ThemeMode[] = ['midnight', 'ocean', 'forest'];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'rose',
      wallpaper: 'botanical',
      customWallpaperUrl: '',
      notificationsEnabled: true,
      notifyMessages: true,
      notifyCalls: true,
      notifySound: true,
      notifyVibration: true,
      dndEnabled: false,

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

      setNotificationsEnabled: (enabled) => {
        set({ notificationsEnabled: enabled });
        const s = get();
        notificationService.updatePreferences({
          enabled,
          messages: s.notifyMessages,
          calls: s.notifyCalls,
          sound: s.notifySound,
          vibration: s.notifyVibration,
          dnd: s.dndEnabled,
        });
      },

      setNotifyMessages: (notifyMessages) => {
        set({ notifyMessages });
        notificationService.updatePreferences({ messages: notifyMessages });
      },

      setNotifyCalls: (notifyCalls) => {
        set({ notifyCalls });
        notificationService.updatePreferences({ calls: notifyCalls });
      },

      setNotifySound: (notifySound) => {
        set({ notifySound });
        notificationService.updatePreferences({ sound: notifySound });
      },

      setNotifyVibration: (notifyVibration) => {
        set({ notifyVibration });
        notificationService.updatePreferences({ vibration: notifyVibration });
      },

      setDndEnabled: (dndEnabled) => {
        set({ dndEnabled });
        notificationService.setDND(dndEnabled);
      },
    }),
    {
      name: 'ivy_settings_preferences',
    }
  )
);
