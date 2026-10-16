import { browser } from 'wxt/browser';
import { sha256Hex } from '@/lib/storage/hash';
import { normalizeUrl } from '@/lib/storage/url';
import type { Card, Summary } from '@/lib/types';

const CARD_PREFIX = 'cache:';
const SUMMARY_PREFIX = 'summary:';

export const CACHE_LIMITS = { cards: 400, summaries: 100 };

interface Entry<T> {
  v: T;
  at: number;
}

async function read<T>(key: string): Promise<T | null> {
  const result = await browser.storage.local.get(key);
  const entry = result[key] as Entry<T> | undefined;
  return entry?.v ?? null;
}

export function getCachedCard(key: string): Promise<Card | null> {
  return read<Card>(CARD_PREFIX + key);
}

export async function setCachedCard(key: string, card: Card, at = Date.now()): Promise<void> {
  const entry: Entry<Card> = { v: card, at };
  await browser.storage.local.set({ [CARD_PREFIX + key]: entry });
}

async function summaryKey(url: string): Promise<string> {
  return SUMMARY_PREFIX + (await sha256Hex(normalizeUrl(url)));
}

export async function getCachedSummary(url: string): Promise<Summary | null> {
  return read<Summary>(await summaryKey(url));
}

export async function setCachedSummary(url: string, summary: Summary, at = Date.now()): Promise<void> {
  const entry: Entry<Summary> = { v: summary, at };
  await browser.storage.local.set({ [await summaryKey(url)]: entry });
}

async function allKeys(): Promise<Record<string, unknown>> {
  return browser.storage.local.get(null);
}

function keysWithPrefix(all: Record<string, unknown>, prefix: string): string[] {
  return Object.keys(all).filter((k) => k.startsWith(prefix));
}

/** Drops the oldest entries beyond each limit. */
export async function trimCaches(limits = CACHE_LIMITS): Promise<number> {
  const all = await allKeys();
  const toRemove: string[] = [];
  for (const [prefix, limit] of [
    [CARD_PREFIX, limits.cards],
    [SUMMARY_PREFIX, limits.summaries],
  ] as const) {
    const keys = keysWithPrefix(all, prefix);
    if (keys.length <= limit) continue;
    keys.sort((a, b) => ((all[b] as Entry<unknown>).at ?? 0) - ((all[a] as Entry<unknown>).at ?? 0));
    toRemove.push(...keys.slice(limit));
  }
  if (toRemove.length) await browser.storage.local.remove(toRemove);
  return toRemove.length;
}

export async function clearCaches(): Promise<number> {
  const all = await allKeys();
  const keys = [...keysWithPrefix(all, CARD_PREFIX), ...keysWithPrefix(all, SUMMARY_PREFIX)];
  if (keys.length) await browser.storage.local.remove(keys);
  return keys.length;
}

export async function cacheStats(): Promise<{ cards: number; summaries: number }> {
  const all = await allKeys();
  return { cards: keysWithPrefix(all, CARD_PREFIX).length, summaries: keysWithPrefix(all, SUMMARY_PREFIX).length };
}
