import { browser } from 'wxt/browser';
import { DEFAULT_PREFS, type Prefs } from '@/lib/types';

/** Read only by the service worker and the options page. Never by content scripts. */
const API_KEY = 'apiKey';
const PREFS = 'prefs';

export async function getApiKey(): Promise<string | null> {
  const result = await browser.storage.local.get(API_KEY);
  const value = result[API_KEY];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) await browser.storage.local.remove(API_KEY);
  else await browser.storage.local.set({ [API_KEY]: trimmed });
}

export async function getPrefs(): Promise<Prefs> {
  const result = await browser.storage.local.get(PREFS);
  const stored = (result[PREFS] ?? {}) as Partial<Prefs>;
  return { ...DEFAULT_PREFS, ...stored };
}

export async function setPrefs(update: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await getPrefs()), ...update };
  await browser.storage.local.set({ [PREFS]: next });
  return next;
}
