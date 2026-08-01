import { useSettingsStore } from '../store/useSettingsStore';
import { WALLPAPER_PRESETS } from '../utils/constants';

export function useWallpaper() {
  const wallpaper = useSettingsStore((state) => state.wallpaper);
  const setWallpaper = useSettingsStore((state) => state.setWallpaper);

  const activePreset = WALLPAPER_PRESETS.find((w) => w.id === wallpaper) || WALLPAPER_PRESETS[0];

  return {
    wallpaper,
    activePreset,
    setWallpaper,
  };
}
