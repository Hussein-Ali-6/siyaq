import { describe, expect, it } from 'vitest';
import { migrateCard, migrateSavedItem } from '@/lib/storage/migrate';
import type { Card, SavedItem } from '@/lib/types';

/** Cards as they were stored before translations had a language. */
const oldWord = {
  kind: 'word',
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  ipaUk: 'ˌtɜːn ˈdaʊn',
  ipaUs: 'ˌtɝːn ˈdaʊn',
  unitIndices: [3, 6],
  meaning: 'to refuse an offer',
  arabic: 'رفض',
  arabicMeaning: 'لم يقبل عرضًا',
  notes: ['Informal.'],
  sentenceArabic: 'رفضوا العرض.',
  examples: ['She turned down the job.'],
  combinations: ['turn down an offer'],
  otherMeanings: [{ meaning: 'to reduce the volume', arabic: 'خفّض' }],
} as unknown as Card;

const oldSentence = {
  kind: 'sentence',
  arabic: 'فشلت الصفقة.',
  plainEnglish: '',
  keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'failed', arabic: 'فشل' }],
} as unknown as Card;

const oldItem = {
  id: 'a',
  kind: 'word',
  card: oldWord,
  selection: 'turned',
  sentence: 'They turned the offer down.',
  sentenceSegments: [{ text: 'They turned the offer down.' }],
  pageTitle: 'Page',
  url: 'https://example.com/p',
  savedAt: 5,
} as SavedItem;

describe('migrateCard', () => {
  it('renames the fields of an old word card and marks it Arabic', () => {
    expect(migrateCard(oldWord)).toEqual({
      kind: 'word',
      language: 'ar',
      headword: 'turn down',
      partOfSpeech: 'phrasal verb',
      ipaUk: 'ˌtɜːn ˈdaʊn',
      ipaUs: 'ˌtɝːn ˈdaʊn',
      unitIndices: [3, 6],
      meaning: 'to refuse an offer',
      translation: 'رفض',
      translationNote: 'لم يقبل عرضًا',
      notes: ['Informal.'],
      sentenceTranslation: 'رفضوا العرض.',
      examples: ['She turned down the job.'],
      combinations: ['turn down an offer'],
      otherMeanings: [{ meaning: 'to reduce the volume', translation: 'خفّض' }],
    });
  });

  it('leaves out the note when the old card had none', () => {
    const { arabicMeaning: _note, ...withoutNote } = oldWord as unknown as Record<string, unknown>;
    expect(migrateCard(withoutNote as unknown as Card)).not.toHaveProperty('translationNote');
  });

  it('renames the fields of an old sentence card', () => {
    expect(migrateCard(oldSentence)).toEqual({
      kind: 'sentence',
      language: 'ar',
      translation: 'فشلت الصفقة.',
      plainEnglish: '',
      keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'failed', translation: 'فشل' }],
    });
  });

  it('returns a card that already has a language unchanged', () => {
    const once = migrateCard(oldWord);
    expect(migrateCard(once)).toBe(once);
  });
});

describe('migrateSavedItem', () => {
  it('converts the card and keeps the rest', () => {
    const next = migrateSavedItem(oldItem);
    expect(next.card).toEqual(migrateCard(oldWord));
    expect({ ...next, card: null }).toEqual({ ...oldItem, card: null });
  });

  it('returns an item that is already converted unchanged', () => {
    const once = migrateSavedItem(oldItem);
    expect(migrateSavedItem(once)).toBe(once);
  });
});
