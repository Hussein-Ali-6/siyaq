import { browser } from 'wxt/browser';
import { languageFromBrowser } from '@/lib/languages';
import { clearCaches } from '@/lib/storage/cache';
import { setPrefs } from '@/lib/storage/settings';
import type { Card, Prefs, SavedItem } from '@/lib/types';

type Fields = Record<string, unknown>;

const list = (value: unknown): Fields[] => (Array.isArray(value) ? (value as Fields[]) : []);

/**
 * Converts a card stored before translations had a language, when Arabic was the only one. A card
 * that already has a language is returned as it is, so converting twice is safe.
 */
export function migrateCard(card: Card): Card {
  const old = card as unknown as Fields;
  if (typeof old.language === 'string') return card;
  if (old.kind === 'word') {
    const { arabic, arabicMeaning, sentenceArabic, otherMeanings, ...rest } = old;
    return {
      ...rest,
      language: 'ar',
      translation: arabic,
      ...(arabicMeaning ? { translationNote: arabicMeaning } : {}),
      sentenceTranslation: sentenceArabic,
      otherMeanings: list(otherMeanings).map(({ arabic: a, ...m }) => ({ ...m, translation: a })),
    } as unknown as Card;
  }
  const { arabic, keyExpressions, ...rest } = old;
  return {
    ...rest,
    language: 'ar',
    translation: arabic,
    keyExpressions: list(keyExpressions).map(({ arabic: a, ...k }) => ({ ...k, translation: a })),
  } as unknown as Card;
}

export function migrateSavedItem(item: SavedItem): SavedItem {
  const card = migrateCard(item.card);
  return card === item.card ? item : { ...item, card };
}

// The same storage keys as `settings.ts` and `saved.ts`, read raw here because this step must see
// what is really stored, without defaults and without the conversion `saved.ts` applies on read.
const PREFS_KEY = 'prefs';
const SAVED_KEY = 'saved';

/** The first version with the language setting. Earlier versions translated into Arabic only. */
const LANGUAGE_SETTING_VERSION = '0.2.0';

/** What the browser tells the worker when the extension is installed or updated. */
export interface InstallDetails {
  reason: string;
  /** The version before an update. */
  previousVersion?: string | undefined;
}

/**
 * True when `version` is earlier than `floor`. Versions are compared by their dot-separated numbers,
 * so "0.10.0" is later than "0.2.0". A missing or unreadable version counts as earlier.
 */
export function isVersionBelow(version: string | undefined, floor: string): boolean {
  if (!version || !/^\d+(\.\d+)*$/.test(version)) return true;
  const mine = version.split('.').map(Number);
  const theirs = floor.split('.').map(Number);
  for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
    const a = mine[i] ?? 0;
    const b = theirs[i] ?? 0;
    if (a !== b) return a < b;
  }
  return false;
}

/**
 * Runs when the extension is installed or updated. Safe to run twice.
 * - No language stored yet, on an update from before 0.2.0: that version translated into Arabic for
 *   an advanced reader, so the install stays on Arabic and Advanced, and its cached answers, which
 *   have the old shape, are removed.
 * - No language stored yet, on a new install or an update from 0.2.0 or later (where an earlier run
 *   of this step failed): start with the browser's language and Upper-intermediate. `uiLanguage` is
 *   called only here.
 * - Saved words are rewritten in the current shape.
 */
export async function prepareStorage(details: InstallDetails, uiLanguage: () => string): Promise<void> {
  const stored = await browser.storage.local.get([PREFS_KEY, SAVED_KEY]);
  const prefs = (stored[PREFS_KEY] ?? {}) as Partial<Prefs>;
  if (typeof prefs.language !== 'string') {
    const { reason, previousVersion } = details;
    if (reason === 'update' && isVersionBelow(previousVersion, LANGUAGE_SETTING_VERSION)) {
      // The caches go first: once a language is stored, a retry would no longer clear them.
      await clearCaches();
      await setPrefs({ language: 'ar', level: 'C1' });
    } else if (reason === 'install' || reason === 'update') {
      await setPrefs({ language: languageFromBrowser(uiLanguage()), level: 'B2' });
    }
  }
  const saved = stored[SAVED_KEY];
  if (Array.isArray(saved) && saved.length) {
    const converted = (saved as SavedItem[]).map(migrateSavedItem);
    if (converted.some((item, i) => item !== saved[i])) await browser.storage.local.set({ [SAVED_KEY]: converted });
  }
}

/**
 * Runs `prepareStorage`, and once more if it fails. Never rejects, so the worker can wait for it
 * before every read of the settings: it resolves to false when both attempts failed, and the worker
 * then logs the failure and carries on with the default settings.
 */
export async function prepareStorageWithRetry(details: InstallDetails, uiLanguage: () => string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prepareStorage(details, uiLanguage);
      return true;
    } catch {
      // Tried once more below, then reported.
    }
  }
  return false;
}
