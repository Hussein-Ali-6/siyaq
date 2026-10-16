import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getApiKey, getPrefs, setApiKey, setPrefs } from '@/lib/storage/settings';

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
  it('defaults to dark and merges partial updates', async () => {
    expect(await getPrefs()).toEqual({ theme: 'dark' });
    expect(await setPrefs({ theme: 'light' })).toEqual({ theme: 'light' });
    expect(await getPrefs()).toEqual({ theme: 'light' });
  });
});
