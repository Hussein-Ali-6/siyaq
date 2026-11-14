import type { Card, SavedItem } from '@/lib/types';

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
