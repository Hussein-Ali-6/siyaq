import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { cacheStats, setCachedCard } from '@/lib/storage/cache';
import { isVersionBelow, migrateCard, migrateSavedItem, prepareStorage, prepareStorageWithRetry } from '@/lib/storage/migrate';
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

describe('isVersionBelow', () => {
  it.each([
    ['0.1.0', true],
    ['0.1.10', true],
    ['0.1.99.4', true],
    ['0.2.0', false],
    ['0.2', false],
    ['0.2.0.1', false],
    ['0.2.1', false],
    // As text "0.10.0" sorts before "0.2.0"; as numbers it is later.
    ['0.10.0', false],
    ['1.0.0', false],
  ])('%s below 0.2.0: %s', (version, below) => {
    expect(isVersionBelow(version, '0.2.0')).toBe(below);
  });

  it('counts a missing or unreadable version as below', () => {
    expect(isVersionBelow(undefined, '0.2.0')).toBe(true);
    expect(isVersionBelow('', '0.2.0')).toBe(true);
    expect(isVersionBelow('next', '0.2.0')).toBe(true);
  });
});

/** Stands for a browser whose interface language must not be asked for. */
const neverAsked = () => {
  throw new Error('the browser language was read');
};
const update = (previousVersion?: string) => ({ reason: 'update', ...(previousVersion ? { previousVersion } : {}) });
const install = { reason: 'install' };

describe('prepareStorage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('keeps an install from before 0.2.0 on Arabic and Advanced, converts saved words and drops cached answers', async () => {
    await fakeBrowser.storage.local.set({ prefs: { theme: 'light' }, saved: [oldItem] });
    await setCachedCard('k1', migrateCard(oldSentence));
    await prepareStorage(update('0.1.0'), neverAsked);
    expect(await getPrefs()).toEqual({ theme: 'light', language: 'ar', level: 'C1' });
    expect(await cacheStats()).toEqual({ cards: 0, summaries: 0 });
    const { saved } = await fakeBrowser.storage.local.get('saved');
    expect((saved as SavedItem[])[0]?.card).toEqual(migrateCard(oldWord));
  });

  it('treats an install from before 0.2.0 that never changed a setting the same way', async () => {
    await prepareStorage(update('0.1.10'), neverAsked);
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'ar', level: 'C1' });
  });

  it('treats an update that does not name the previous version as one from before 0.2.0', async () => {
    await prepareStorage(update(), neverAsked);
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'ar', level: 'C1' });
  });

  it('starts an update from 0.2.0 or later that has no language like a new install, and keeps its cache', async () => {
    await setCachedCard('k1', migrateCard(oldSentence));
    await prepareStorage(update('0.2.0'), () => 'es-MX');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'es', level: 'B2' });
    expect((await cacheStats()).cards).toBe(1);
  });

  it('compares the previous version by its numbers, so 0.10.0 is later than 0.2.0', async () => {
    await prepareStorage(update('0.10.0'), () => 'ja');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'ja', level: 'B2' });
  });

  it('starts a new install on the browser language and Upper-intermediate', async () => {
    await prepareStorage(install, () => 'es-MX');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'es', level: 'B2' });
  });

  it('starts a new install in English only when the browser language is English', async () => {
    await prepareStorage(install, () => 'en-GB');
    expect((await getPrefs()).language).toBe('none');
  });

  it('leaves chosen settings and the cache alone on later updates', async () => {
    await fakeBrowser.storage.local.set({ prefs: { theme: 'dark', language: 'ja', level: 'B1' } });
    await setCachedCard('k1', migrateCard(oldSentence));
    await prepareStorage(update('0.1.0'), neverAsked);
    await prepareStorage(update('0.2.0'), neverAsked);
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'ja', level: 'B1' });
    expect((await cacheStats()).cards).toBe(1);
  });

  it('does not change the settings for a browser update', async () => {
    await prepareStorage({ reason: 'chrome_update' }, neverAsked);
    expect(await fakeBrowser.storage.local.get('prefs')).toEqual({});
  });

  it('does not write the saved list when every saved word is already in the new shape', async () => {
    const converted = migrateSavedItem(oldItem);
    await fakeBrowser.storage.local.set({ prefs: { language: 'ja', level: 'B1' }, saved: [converted] });
    const set = vi.spyOn(fakeBrowser.storage.local, 'set');
    await prepareStorage(update('0.2.0'), neverAsked);
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });
});

describe('prepareStorageWithRetry', () => {
  beforeEach(() => fakeBrowser.reset());

  it('runs the step once when it works', async () => {
    const uiLanguage = vi.fn(() => 'fr-CA');
    expect(await prepareStorageWithRetry(install, uiLanguage)).toBe(true);
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'fr', level: 'B2' });
    expect(uiLanguage).toHaveBeenCalledTimes(1);
  });

  it('runs the step again when the first attempt fails', async () => {
    await fakeBrowser.storage.local.set({ prefs: { theme: 'light' }, saved: [oldItem] });
    await setCachedCard('k1', migrateCard(oldSentence));
    // The first attempt gets as far as clearing the cache and then cannot store the settings.
    const set = vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValueOnce(new Error('storage is busy'));
    expect(await prepareStorageWithRetry(update('0.1.0'), neverAsked)).toBe(true);
    set.mockRestore();
    expect(await getPrefs()).toEqual({ theme: 'light', language: 'ar', level: 'C1' });
    expect(await cacheStats()).toEqual({ cards: 0, summaries: 0 });
    const { saved } = await fakeBrowser.storage.local.get('saved');
    expect((saved as SavedItem[])[0]?.card).toEqual(migrateCard(oldWord));
  });

  it('resolves and reports the failure when both attempts fail', async () => {
    const get = vi.spyOn(fakeBrowser.storage.local, 'get').mockRejectedValue(new Error('storage is broken'));
    const result = await prepareStorageWithRetry(update('0.1.0'), neverAsked);
    expect(get).toHaveBeenCalledTimes(2);
    get.mockRestore();
    expect(result).toBe(false);
    expect(await fakeBrowser.storage.local.get('prefs')).toEqual({});
  });

  it('reports a failure, and does not reject, when the browser language cannot be read', async () => {
    const uiLanguage = vi.fn(neverAsked);
    expect(await prepareStorageWithRetry(install, uiLanguage)).toBe(false);
    expect(uiLanguage).toHaveBeenCalledTimes(2);
  });
});
