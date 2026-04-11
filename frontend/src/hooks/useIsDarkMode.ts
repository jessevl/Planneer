import { useSettingsStore } from '@/stores/settingsStore';

/** Check if we're in dark mode */
export const useIsDarkMode = (): boolean => {
  const theme = useSettingsStore(s => s.theme);
  return theme === 'dark' || 
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
};
