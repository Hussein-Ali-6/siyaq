import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { isSaved, listSaved, removeSaved, saveItem, searchSaved, toCsv, toJson } from '@/lib/storage/saved';
import type { SavedItem } from '@/lib/types';

beforeEach(() => fakeBrowser.reset());

function wordItem(id: string, headword: string, arabic: string): Omit<SavedItem, 'savedAt'> {
  return {
    id,
    kind: 'word',
    card: {
      kind: 'word',
      headword,
      partOfSpeech: 'verb',
      ipaUk: 'tɛst',
      ipaUs: 'test',
      unitIndices: [1],
      meaning: `to ${headword} something`,
      arabic,
      arabicMeaning: `شرح ${arabic}`,
      notes: [],
      sentenceArabic: 'جملة',
      examples: ['a', 'b'],
      combinations: [],
      otherMeanings: [],
    },
    selection: headword,
    sentence: `They ${headword} it.`,
    sentenceSegments: [{ text: 'They ' }, { text: headword, bold: true }, { text: ' it.' }],
    pageTitle: 'Page',
    url: 'https://example.com/p',
  };
}

describe('saved items', () => {
  it('lists newest first and upserts by id', async () => {
    await saveItem(wordItem('a', 'refuse', 'رفض'), 1000);
    await saveItem(wordItem('b', 'accept', 'قبل'), 2000);
    await saveItem(wordItem('a', 'refuse', 'رفض'), 3000);
    const items = await listSaved();
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(items[0]?.savedAt).toBe(3000);
  });

  it('removes and reports saved state', async () => {
    await saveItem(wordItem('a', 'refuse', 'رفض'));
    expect(await isSaved('a')).toBe(true);
    await removeSaved('a');
    expect(await isSaved('a')).toBe(false);
    expect(await listSaved()).toEqual([]);
  });
});

describe('searchSaved', () => {
  const items: SavedItem[] = [
    { ...wordItem('a', 'refuse', 'رفض'), savedAt: 1 },
    { ...wordItem('b', 'accept', 'قَبِلَ'), savedAt: 2 },
    {
      id: 'c',
      kind: 'sentence',
      card: { kind: 'sentence', arabic: 'ذهب أحمد إلى السوق.', plainEnglish: '', keyExpressions: [] },
      selection: 'Ahmed went to the market.',
      sentence: 'Ahmed went to the market.',
      sentenceSegments: [{ text: 'Ahmed went to the market.' }],
      pageTitle: 'News',
      url: 'https://example.com/n',
      savedAt: 3,
    },
  ];

  it('matches English fields case-insensitively', () => {
    expect(searchSaved(items, 'REFUSE').map((i) => i.id)).toEqual(['a']);
    expect(searchSaved(items, 'market').map((i) => i.id)).toEqual(['c']);
  });

  it('matches Arabic ignoring diacritics and alef variants', () => {
    expect(searchSaved(items, 'قبل').map((i) => i.id)).toEqual(['b']);
    expect(searchSaved(items, 'احمد').map((i) => i.id)).toEqual(['c']);
  });

  it('still matches the Arabic explanation on cards saved while it was a separate field', () => {
    expect(searchSaved(items, 'شرح رفض').map((i) => i.id)).toEqual(['a']);
  });

  it('returns everything for a blank query', () => {
    expect(searchSaved(items, '  ')).toHaveLength(3);
  });
});

describe('export', () => {
  it('writes CSV with quoting and JSON with all items', () => {
    const items: SavedItem[] = [
      { ...wordItem('a', 'say "hi"', 'قال'), savedAt: Date.UTC(2026, 9, 16) },
    ];
    const csv = toCsv(items);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('kind,headword,ipa_uk,ipa_us,arabic,meaning,sentence,translation,page,url,saved');
    expect(lines[1]).toContain(',tɛst,test,');
    expect(lines[1]).toContain('قال — شرح قال');
    expect(lines[1]).toContain('"say ""hi"""');
    expect(lines[1]).toContain('2026-10-16');
    expect(JSON.parse(toJson(items))).toHaveLength(1);
  });
});
