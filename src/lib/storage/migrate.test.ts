import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { cacheStats, setCachedCard } from '@/lib/storage/cache';
import { migrateCard, migrateSavedItem, prepareStorage } from '@/lib/storage/migrate';
import { getPrefs } from '@/lib/storage/settings';
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

describe('prepareStorage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('keeps an existing install on Arabic and Advanced, converts saved words and drops cached answers', async () => {
    await fakeBrowser.storage.local.set({ prefs: { theme: 'light' }, saved: [oldItem] });
    await setCachedCard('k1', migrateCard(oldSentence));
    await prepareStorage('update', 'en-US');
    expect(await getPrefs()).toEqual({ theme: 'light', language: 'ar', level: 'C1' });
    expect(await cacheStats()).toEqual({ cards: 0, summaries: 0 });
    const { saved } = await fakeBrowser.storage.local.get('saved');
    expect((saved as SavedItem[])[0]?.card).toEqual(migrateCard(oldWord));
  });

  it('treats an existing install that never changed a setting the same way', async () => {
    await prepareStorage('update', 'es-ES');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'ar', level: 'C1' });
  });

  it('starts a new install on the browser language and Upper-intermediate', async () => {
    await prepareStorage('install', 'es-MX');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'es', level: 'B2' });
  });

  it('starts a new install in English only when the browser language is English', async () => {
    await prepareStorage('install', 'en-GB');
    expect((await getPrefs()).language).toBe('none');
  });

  it('leaves chosen settings and the cache alone on later updates', async () => {
    await fakeBrowser.storage.local.set({ prefs: { theme: 'dark', language: 'ja', level: 'B1' } });
    await setCachedCard('k1', migrateCard(oldSentence));
    await prepareStorage('update', 'en-US');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'ja', level: 'B1' });
    expect((await cacheStats()).cards).toBe(1);
  });

  it('does not write the saved list when every saved word is already in the new shape', async () => {
    const converted = migrateSavedItem(oldItem);
    await fakeBrowser.storage.local.set({ prefs: { language: 'ja', level: 'B1' }, saved: [converted] });
    const set = vi.spyOn(fakeBrowser.storage.local, 'set');
    await prepareStorage('update', 'en-US');
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });
});
