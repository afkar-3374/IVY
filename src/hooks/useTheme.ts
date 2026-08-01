import { useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

export function useTheme() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'midnight') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  return { theme, setTheme };
}
