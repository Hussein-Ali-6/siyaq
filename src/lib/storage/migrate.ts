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

/**
 * Runs when the extension is installed or updated.
 * - No language stored yet, on an update: this install predates the language setting, so it stays on
 *   Arabic and Advanced, and its cached answers, which have the old shape, are removed.
 * - No language stored yet, on a new install: start with the browser's language and Upper-intermediate.
 * - Saved words are rewritten in the current shape.
 */
export async function prepareStorage(reason: string, uiLanguage: string): Promise<void> {
  const stored = await browser.storage.local.get([PREFS_KEY, SAVED_KEY]);
  const prefs = (stored[PREFS_KEY] ?? {}) as Partial<Prefs>;
  if (typeof prefs.language !== 'string') {
    if (reason === 'update') {
      await setPrefs({ language: 'ar', level: 'C1' });
      await clearCaches();
    } else if (reason === 'install') {
      await setPrefs({ language: languageFromBrowser(uiLanguage), level: 'B2' });
    }
  }
  const saved = stored[SAVED_KEY];
  if (Array.isArray(saved) && saved.length) {
    await browser.storage.local.set({ [SAVED_KEY]: (saved as SavedItem[]).map(migrateSavedItem) });
  }
}
