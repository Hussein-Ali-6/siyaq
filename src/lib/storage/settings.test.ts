import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  clearChatGptTokens,
  getActiveProvider,
  getApiKey,
  getChatGptAuth,
  getPrefs,
  getProviderKey,
  getProviderSettings,
  prefsFromStored,
  setActiveProvider,
  setApiKey,
  setChatGptAuth,
  setPrefs,
  setProviderKey,
  setProviderSettings,
} from '@/lib/storage/settings';

beforeEach(() => fakeBrowser.reset());

describe('api key', () => {
  it('is null until set, then round-trips trimmed', async () => {
    expect(await getApiKey()).toBeNull();
    await setApiKey('  sk-ant-test  ');
    expect(await getApiKey()).toBe('sk-ant-test');
  });

  it('is removed when set to blank', async () => {
    await setApiKey('sk-ant-test');
    await setApiKey('   ');
    expect(await getApiKey()).toBeNull();
  });
});

describe('prefs', () => {
  it('defaults to dark, English only and B2, and merges partial updates', async () => {
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'none', level: 'B2' });
    expect(await setPrefs({ theme: 'light' })).toEqual({ theme: 'light', language: 'none', level: 'B2' });
    expect(await setPrefs({ language: 'es', level: 'C1' })).toEqual({ theme: 'light', language: 'es', level: 'C1' });
    expect(await getPrefs()).toEqual({ theme: 'light', language: 'es', level: 'C1' });
  });
});

describe('prefsFromStored', () => {
  it('fills in the defaults for what is not stored', () => {
    expect(prefsFromStored(undefined)).toEqual({ theme: 'dark', language: 'none', level: 'B2' });
    expect(prefsFromStored({ theme: 'light' })).toEqual({ theme: 'light', language: 'none', level: 'B2' });
  });

  it('keeps stored values that are usable', () => {
    expect(prefsFromStored({ theme: 'light', language: 'ar', level: 'C1' })).toEqual({ theme: 'light', language: 'ar', level: 'C1' });
    expect(prefsFromStored({ language: 'x:Kurdish', level: 'B1' })).toEqual({ theme: 'dark', language: 'x:Kurdish', level: 'B1' });
  });

  it.each([['A2'], ['c1'], [''], [2], [null]])('falls back to the default level for %j', (level) => {
    expect(prefsFromStored({ theme: 'light', language: 'es', level })).toEqual({ theme: 'light', language: 'es', level: 'B2' });
  });

  it.each([[''], ['   '], [5], [null], [['ar']]])('falls back to the default language for %j', (language) => {
    expect(prefsFromStored({ language, level: 'C1' })).toEqual({ theme: 'dark', language: 'none', level: 'C1' });
  });

  it('treats a stored value that is not an object as nothing stored', () => {
    expect(prefsFromStored('ar')).toEqual({ theme: 'dark', language: 'none', level: 'B2' });
    expect(prefsFromStored(null)).toEqual({ theme: 'dark', language: 'none', level: 'B2' });
  });

  it('is what getPrefs returns, so a bad stored value never reaches a prompt', async () => {
    await fakeBrowser.storage.local.set({ prefs: { theme: 'light', language: '', level: 'C2' } });
    expect(await getPrefs()).toEqual({ theme: 'light', language: 'none', level: 'B2' });
  });
});

describe('providers', () => {
  it('defaults to Anthropic and remembers the active provider', async () => {
    expect(await getActiveProvider()).toBe('anthropic');
    await setActiveProvider('openai');
    expect(await getActiveProvider()).toBe('openai');
  });

  it('keeps one key per provider, with the original key as the Anthropic key', async () => {
    await setApiKey('sk-ant-old');
    expect(await getProviderKey('anthropic')).toBe('sk-ant-old');
    await setProviderKey('openai', ' sk-openai ');
    expect(await getProviderKey('openai')).toBe('sk-openai');
    expect(await getProviderKey('google')).toBeNull();
    await setProviderKey('openai', '');
    expect(await getProviderKey('openai')).toBeNull();
  });

  it('stores model and thinking per provider with sensible defaults', async () => {
    expect(await getProviderSettings('anthropic')).toEqual({ model: 'claude-sonnet-5-5', thinking: 'medium' });
    expect(await getProviderSettings('openai')).toEqual({ model: '', thinking: 'medium' });
    await setProviderSettings('openai', { model: 'gpt-x' });
    expect(await getProviderSettings('openai')).toEqual({ model: 'gpt-x', thinking: 'medium' });
  });

  it('clears ChatGPT tokens but keeps the client registration for signing in again', async () => {
    await setChatGptAuth({ clientId: 'client_1', hostId: 'urn:uuid:x', port: 51234, accessToken: 'at', refreshToken: 'rt', expiresAt: 5, scopes: ['openid'], email: 'a@b.c' });
    await clearChatGptTokens();
    expect(await getChatGptAuth()).toEqual({ clientId: 'client_1', hostId: 'urn:uuid:x', port: 51234, email: 'a@b.c' });
  });
});
