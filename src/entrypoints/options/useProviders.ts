import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { hasPlanUsage } from '@/lib/auth/chatgpt-oauth';
import { PROVIDERS } from '@/lib/llm/providers';
import type { ProviderId } from '@/lib/llm/types';
import { getActiveProvider, getChatGptAuth, getProviderKey, getProviderSettings } from '@/lib/storage/settings';
import type { ProviderView, ProviderViews } from './status';

async function loadView(id: ProviderId): Promise<ProviderView> {
  const info = PROVIDERS.find((p) => p.id === id)!;
  const settings = await getProviderSettings(id);
  const permitted = await browser.permissions.contains({ origins: info.origins }).catch(() => false);
  if (id === 'chatgpt') {
    const auth = await getChatGptAuth();
    const signedIn = !!auth?.accessToken;
    const planUsage = signedIn && hasPlanUsage(auth?.scopes);
    return { id, hasCredential: signedIn, permitted, settings, email: auth?.email, planUsage, ready: signedIn && planUsage && permitted && !!settings.model };
  }
  const hasCredential = !!(await getProviderKey(id));
  return { id, hasCredential, permitted, settings, ready: hasCredential && permitted && !!settings.model };
}

/** Status of every provider plus the active one, kept in sync with storage. */
export function useProviders() {
  const [views, setViews] = useState<ProviderViews | null>(null);
  const [active, setActive] = useState<ProviderId>('anthropic');

  const reload = useCallback(async () => {
    // Both are read before either is set, so no render ever pairs new views with the old active provider.
    const [list, current] = await Promise.all([Promise.all(PROVIDERS.map((p) => loadView(p.id))), getActiveProvider()]);
    setViews(Object.fromEntries(list.map((v) => [v.id, v])) as ProviderViews);
    setActive(current);
  }, []);

  useEffect(() => {
    void reload();
    const onChanged = (_changes: unknown, area: string) => {
      if (area === 'local') void reload();
    };
    browser.storage.onChanged.addListener(onChanged);
    browser.permissions.onAdded.addListener(reload);
    browser.permissions.onRemoved.addListener(reload);
    return () => {
      browser.storage.onChanged.removeListener(onChanged);
      browser.permissions.onAdded.removeListener(reload);
      browser.permissions.onRemoved.removeListener(reload);
    };
  }, [reload]);

  return { views, active, reload };
}
