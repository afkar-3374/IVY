import { useSettingsStore } from '../store/useSettingsStore';
import { WALLPAPER_PRESETS } from '../utils/constants';

export function useWallpaper() {
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const customWallpaperUrl = useSettingsStore((state) => state.customWallpaperUrl);
  const setWallpaper = useSettingsStore((state) => state.setWallpaper);
  const setCustomWallpaper = useSettingsStore((state) => state.setCustomWallpaper);

  const activePreset =
    wallpaper === 'custom'
      ? { id: 'custom', name: 'Custom Photo', bgClass: '' }
      : WALLPAPER_PRESETS.find((w) => w.id === wallpaper) || WALLPAPER_PRESETS[0];

  return {
    wallpaper,
    customWallpaperUrl,
    activePreset,
    setWallpaper,
    setCustomWallpaper,
  };
}
