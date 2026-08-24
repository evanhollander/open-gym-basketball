import { useEffect } from 'react';
import { useGameState } from '../state/context';

/** No visible UI - just applies the Settings > Appearance choice by toggling
 * a `dark` class on <html> (see the @custom-variant override in index.css
 * that makes Tailwind's dark: respond to that class instead of only
 * prefers-color-scheme). When set to "System", also listens for the OS
 * theme changing while the app is open and follows it live. */
export function ThemeManager() {
  const { theme } = useGameState();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function apply() {
      root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    }

    apply();

    if (theme === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
  }, [theme]);

  return null;
}
