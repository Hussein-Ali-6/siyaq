import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { hasPlanUsage } from '@/lib/auth/chatgpt-oauth';
import { PROVIDERS } from '@/lib/llm/providers';
import type { ProviderId } from '@/lib/llm/types';
import { getActiveProvider, getChatGptAuth, getProviderKey, getProviderSettings, type ProviderSettings } from '@/lib/storage/settings';

export interface ProviderView {
  id: ProviderId;
  /** An API key is saved, or the reader is signed in to ChatGPT. */
  hasCredential: boolean;
  /** The optional host permission for this provider is granted. */
  permitted: boolean;
  settings: ProviderSettings;
  email?: string;
  planUsage?: boolean;
  /** Everything needed for lookups is in place. */
  ready: boolean;
}

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
  const [views, setViews] = useState<Record<ProviderId, ProviderView> | null>(null);
  const [active, setActive] = useState<ProviderId>('anthropic');

  const reload = useCallback(async () => {
    const list = await Promise.all(PROVIDERS.map((p) => loadView(p.id)));
    setViews(Object.fromEntries(list.map((v) => [v.id, v])) as Record<ProviderId, ProviderView>);
    setActive(await getActiveProvider());
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

export function statusLabel(view: ProviderView, isActive: boolean): { text: string; tone: 'active' | 'ready' | 'pending' | 'off' } {
  if (isActive && view.ready) return { text: 'Active', tone: 'active' };
  if (view.ready) return { text: 'Ready', tone: 'ready' };
  if (view.hasCredential && view.id === 'chatgpt' && !view.planUsage) return { text: 'Plan usage off', tone: 'pending' };
  if (view.hasCredential && !view.settings.model) return { text: 'Choose a model', tone: 'pending' };
  if (view.hasCredential && !view.permitted) return { text: 'Needs permission', tone: 'pending' };
  return { text: isActive ? 'Active, not set up' : 'Not set up', tone: isActive ? 'pending' : 'off' };
}
