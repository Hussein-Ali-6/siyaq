import { browser } from 'wxt/browser';
import type { ChatGptAuth } from '@/lib/auth/chatgpt-oauth';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/llm/anthropic';
import { isProviderId } from '@/lib/llm/providers';
import type { ProviderId, Thinking } from '@/lib/llm/types';
import { DEFAULT_PREFS, type Prefs } from '@/lib/types';

/**
 * Read only by the service worker and extension pages, never by content scripts. Keys and tokens
 * live in chrome.storage.local (not synced); the worker also limits local storage to trusted contexts.
 */
const LEGACY_ANTHROPIC_KEY = 'apiKey';
const PREFS = 'prefs';
const ACTIVE_PROVIDER = 'activeProvider';
const PROVIDER_SETTINGS = 'providerSettings';
const CHATGPT = 'chatgpt';

const keyName = (provider: ProviderId) => (provider === 'anthropic' ? LEGACY_ANTHROPIC_KEY : `apiKey:${provider}`);

async function readString(key: string): Promise<string | null> {
  const value = (await browser.storage.local.get(key))[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function writeString(key: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) await browser.storage.local.remove(key);
  else await browser.storage.local.set({ [key]: trimmed });
}

/** The Anthropic key, under its original storage name so existing installs keep working. */
export const getApiKey = () => readString(LEGACY_ANTHROPIC_KEY);
export const setApiKey = (key: string) => writeString(LEGACY_ANTHROPIC_KEY, key);

export const getProviderKey = (provider: ProviderId) => readString(keyName(provider));
export const setProviderKey = (provider: ProviderId, key: string) => writeString(keyName(provider), key);

export async function getActiveProvider(): Promise<ProviderId> {
  const value = (await browser.storage.local.get(ACTIVE_PROVIDER))[ACTIVE_PROVIDER];
  return isProviderId(value) ? value : 'anthropic';
}

export async function setActiveProvider(provider: ProviderId): Promise<void> {
  await browser.storage.local.set({ [ACTIVE_PROVIDER]: provider });
}

export interface ProviderSettings {
  model: string;
  thinking: Thinking;
}

const DEFAULT_SETTINGS = (provider: ProviderId): ProviderSettings => ({
  model: provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : '',
  thinking: 'medium',
});

async function allProviderSettings(): Promise<Partial<Record<ProviderId, Partial<ProviderSettings>>>> {
  const value = (await browser.storage.local.get(PROVIDER_SETTINGS))[PROVIDER_SETTINGS];
  return typeof value === 'object' && value !== null ? (value as Partial<Record<ProviderId, Partial<ProviderSettings>>>) : {};
}

export async function getProviderSettings(provider: ProviderId): Promise<ProviderSettings> {
  const stored = (await allProviderSettings())[provider] ?? {};
  const defaults = DEFAULT_SETTINGS(provider);
  return {
    model: typeof stored.model === 'string' && stored.model.trim() ? stored.model.trim() : defaults.model,
    thinking: stored.thinking === 'low' || stored.thinking === 'medium' || stored.thinking === 'high' ? stored.thinking : defaults.thinking,
  };
}

export async function setProviderSettings(provider: ProviderId, update: Partial<ProviderSettings>): Promise<ProviderSettings> {
  const all = await allProviderSettings();
  const next = { ...(await getProviderSettings(provider)), ...update };
  await browser.storage.local.set({ [PROVIDER_SETTINGS]: { ...all, [provider]: next } });
  return next;
}

export async function getChatGptAuth(): Promise<ChatGptAuth | null> {
  const value = (await browser.storage.local.get(CHATGPT))[CHATGPT];
  return typeof value === 'object' && value !== null ? (value as ChatGptAuth) : null;
}

export async function setChatGptAuth(auth: ChatGptAuth): Promise<void> {
  await browser.storage.local.set({ [CHATGPT]: auth });
}

/** Signs out: drops the tokens but keeps this install's registration so signing in again reuses it. */
export async function clearChatGptTokens(): Promise<void> {
  const auth = await getChatGptAuth();
  if (!auth) return;
  const { clientId, hostId, port, email } = auth;
  await setChatGptAuth({ hostId, port, ...(clientId ? { clientId } : {}), ...(email ? { email } : {}) });
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
