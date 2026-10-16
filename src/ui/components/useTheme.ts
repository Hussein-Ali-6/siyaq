import { useEffect, useState } from 'react';
import { getPrefs } from '@/lib/storage/settings';
import { browser } from 'wxt/browser';
import type { Prefs } from '@/lib/types';

/** Applies the saved theme to <body> on extension pages and follows later changes. */
export function useTheme(): Prefs['theme'] {
  const [theme, setTheme] = useState<Prefs['theme']>('dark');
  useEffect(() => {
    void getPrefs().then((p) => setTheme(p.theme));
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes.prefs?.newValue) setTheme((changes.prefs.newValue as Prefs).theme);
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light');
  }, [theme]);
  return theme;
}
