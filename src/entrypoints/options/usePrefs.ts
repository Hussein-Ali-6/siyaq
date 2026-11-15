import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getPrefs, prefsFromStored } from '@/lib/storage/settings';
import type { Prefs } from '@/lib/types';

/** The stored preferences, kept in sync with storage. Null until they have been read. */
export function usePrefs(): Prefs | null {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    void getPrefs().then(setPrefs);
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes.prefs) setPrefs(prefsFromStored(changes.prefs.newValue));
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);
  return prefs;
}
