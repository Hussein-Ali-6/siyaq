import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  cacheStats,
  clearCaches,
  getCachedCard,
  getCachedSummary,
  setCachedCard,
  setCachedSummary,
  trimCaches,
} from '@/lib/storage/cache';
import type { Card } from '@/lib/types';

const card: Card = { kind: 'sentence', language: 'ar', translation: 'مرحبا', plainEnglish: '', keyExpressions: [] };

beforeEach(() => fakeBrowser.reset());

describe('card cache', () => {
  it('misses, then hits after a write', async () => {
    expect(await getCachedCard('k1')).toBeNull();
    await setCachedCard('k1', card);
    expect(await getCachedCard('k1')).toEqual(card);
  });
});

describe('summary cache', () => {
  it('is keyed by the normalised URL and the language', async () => {
    const summary = { language: 'ar', english: 'Gist.', translation: 'الخلاصة.' };
    await setCachedSummary('https://example.com/a?utm_source=x#top', 'ar', summary);
    expect(await getCachedSummary('https://example.com/a', 'ar')).toEqual(summary);
    expect(await getCachedSummary('https://example.com/a', 'AR')).toEqual(summary);
    expect(await getCachedSummary('https://example.com/a', 'es')).toBeNull();
    expect(await getCachedSummary('https://example.com/b', 'ar')).toBeNull();
  });
});

describe('trim and clear', () => {
  it('keeps only the newest entries', async () => {
    for (let i = 0; i < 5; i++) {
      await setCachedCard(`k${i}`, card, 1000 + i);
    }
    await trimCaches({ cards: 2, summaries: 10 });
    expect(await getCachedCard('k0')).toBeNull();
    expect(await getCachedCard('k2')).toBeNull();
    expect(await getCachedCard('k3')).toEqual(card);
    expect(await getCachedCard('k4')).toEqual(card);
  });

  it('counts and clears both caches without touching other keys', async () => {
    await setCachedCard('k1', card);
    await setCachedSummary('https://example.com/a', 'ar', { language: 'ar', english: 'e', translation: 'ع' });
    await fakeBrowser.storage.local.set({ apiKey: 'keep-me' });
    expect(await cacheStats()).toEqual({ cards: 1, summaries: 1 });
    expect(await clearCaches()).toBe(2);
    expect(await cacheStats()).toEqual({ cards: 0, summaries: 0 });
    expect((await fakeBrowser.storage.local.get('apiKey')).apiKey).toBe('keep-me');
  });
});
