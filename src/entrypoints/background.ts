import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { listModels } from '@/lib/llm/catalog';
import { performLookup } from '@/lib/llm/lookup';
import { providerInfo } from '@/lib/llm/providers';
import { resolveActiveClient, resolveClient } from '@/lib/llm/resolve';
import { performSummary } from '@/lib/llm/summary';
import { LlmError } from '@/lib/llm/types';
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
import { getPrefs, getProviderSettings } from '@/lib/storage/settings';
import type { Card } from '@/lib/types';

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

  browser.runtime.onInstalled.addListener(({ reason }) => {
    // Chrome 130+: keep local storage (where keys and tokens live) out of reach of content scripts.
    const local = browser.storage.local as unknown as { setAccessLevel?: (o: { accessLevel: string }) => Promise<void> };
    local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => undefined);
    if (reason === 'install') void browser.runtime.openOptionsPage();
  });

  onMessage('lookup', async ({ data }) => {
    const r = await resolveActiveClient();
    if ('error' in r) return { ok: false, error: r.error };
    return performLookup(data, { client: r.client, modelId: r.modelId, cache: cardCache, getSummary: getCachedSummary });
  });

  onMessage('getSummary', ({ data }) => getCachedSummary(data));

  onMessage('summarize', async ({ data }) => {
    const r = await resolveActiveClient();
    if ('error' in r) return { ok: false, error: r.error };
    return performSummary(data, { client: r.client, cache: summaryCache });
  });

  onMessage('saveItem', ({ data }) => saveItem(data));
  onMessage('unsaveItem', ({ data }) => removeSaved(data));
  onMessage('isSaved', ({ data }) => isSaved(data));
  onMessage('getPrefs', () => getPrefs());

  onMessage('getStatus', async () => {
    const r = await resolveActiveClient();
    const provider = r.provider;
    return {
      provider,
      providerName: providerInfo(provider).name,
      model: 'error' in r ? (await getProviderSettings(provider)).model : r.model,
      ready: !('error' in r),
      ...('error' in r ? { problem: r.error.message } : {}),
    };
  });

  onMessage('testProvider', async ({ data: provider }) => {
    const r = await resolveClient(provider);
    if ('error' in r) return { ok: false, message: r.error.message };
    try {
      await r.client.ping();
      return { ok: true, message: `${providerInfo(provider).name} works with ${r.model}.` };
    } catch (err) {
      const e = err instanceof LlmError ? err : new LlmError('unknown', 'Unexpected error.');
      log.warn('provider_test_failed', { code: e.code, status: e.status ?? 0, kind: provider });
      return { ok: false, message: e.message };
    }
  });

  onMessage('listModels', async ({ data: provider }) => {
    try {
      const catalog = await listModels(provider);
      return { ok: true, ...catalog };
    } catch (err) {
      const e = err instanceof LlmError ? err : new LlmError('unknown', 'Could not load the model list.');
      log.warn('list_models_failed', { code: e.code, status: e.status ?? 0, kind: provider });
      return { ok: false, message: e.message };
    }
  });

  onMessage('clearCaches', async () => ({ removed: await clearCaches() }));
  onMessage('openOptions', () => browser.runtime.openOptionsPage());

  log.info('background_ready');
});
