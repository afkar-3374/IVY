import { useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

const DARK_THEMES = ['midnight', 'ocean', 'forest'];

export function useTheme() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (DARK_THEMES.includes(theme)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  return { theme, setTheme };
}
