import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { ClaudeError, createClaudeClient, type ClaudeClient } from '@/lib/claude/client';
import { performLookup } from '@/lib/claude/lookup';
import { performSummary } from '@/lib/claude/summary';
import { log } from '@/lib/log';
import { onMessage } from '@/lib/messaging';
import {
  clearCaches,
  getCachedCard,
  getCachedSummary,
  setCachedCard,
  setCachedSummary,
  trimCaches,
} from '@/lib/storage/cache';
import { isSaved, removeSaved, saveItem } from '@/lib/storage/saved';
import { getApiKey, getPrefs } from '@/lib/storage/settings';
import type { Card, UserError } from '@/lib/types';

const NO_KEY: UserError = { code: 'no_key', message: 'Add your Anthropic API key in Siyaq settings.' };

export default defineBackground(() => {
  let writes = 0;
  const cardCache = {
    get: getCachedCard,
    set: async (key: string, card: Card) => {
      await setCachedCard(key, card);
      if (++writes % 25 === 0) void trimCaches().catch(() => undefined);
    },
  };
  const summaryCache = { get: getCachedSummary, set: setCachedSummary };

  // One SDK client per key; rebuilt when the key changes.
  let clientKey: string | null = null;
  let client: ClaudeClient | null = null;
  async function getClient(): Promise<{ client: ClaudeClient } | { error: UserError }> {
    const key = await getApiKey();
    if (!key) return { error: NO_KEY };
    if (!client || clientKey !== key) {
      client = createClaudeClient(key);
      clientKey = key;
    }
    return { client };
  }

  browser.runtime.onInstalled.addListener(({ reason }) => {
    // Chrome 130+: keep local storage (where the key lives) out of reach of content scripts.
    const local = browser.storage.local as unknown as { setAccessLevel?: (o: { accessLevel: string }) => Promise<void> };
    local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => undefined);
    if (reason === 'install') void browser.runtime.openOptionsPage();
  });

  onMessage('lookup', async ({ data }) => {
    const c = await getClient();
    if ('error' in c) return { ok: false, error: c.error };
    return performLookup(data, { client: c.client, cache: cardCache, getSummary: getCachedSummary });
  });

  onMessage('getSummary', ({ data }) => getCachedSummary(data));

  onMessage('summarize', async ({ data }) => {
    const c = await getClient();
    if ('error' in c) return { ok: false, error: c.error };
    return performSummary(data, { client: c.client, cache: summaryCache });
  });

  onMessage('saveItem', ({ data }) => saveItem(data));
  onMessage('unsaveItem', ({ data }) => removeSaved(data));
  onMessage('isSaved', ({ data }) => isSaved(data));
  onMessage('getPrefs', () => getPrefs());
  onMessage('getStatus', async () => ({ hasKey: (await getApiKey()) !== null }));

  onMessage('testApiKey', async () => {
    const c = await getClient();
    if ('error' in c) return { ok: false, message: c.error.message };
    try {
      await c.client.ping();
      return { ok: true, message: 'The key works.' };
    } catch (err) {
      const e = err instanceof ClaudeError ? err : new ClaudeError('unknown', 'Unexpected error.');
      log.warn('key_test_failed', { code: e.code, status: e.status ?? 0 });
      return { ok: false, message: e.message };
    }
  });

  onMessage('clearCaches', async () => ({ removed: await clearCaches() }));
  onMessage('openOptions', () => browser.runtime.openOptionsPage());

  log.info('background_ready');
});
