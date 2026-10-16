import { describe, expect, it } from 'vitest';
import { buildSentencePassage } from '@/lib/text/tokens';
import { validateDictionary, validateSummary, validateTranslation } from '@/lib/claude/validate';

// Before(1) They(2) turned(3) the(4) offer(5) down(6) After(7)
const passage = buildSentencePassage('Before. They turned the offer down. After.');

const good = {
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  unitIndices: [3, 6],
  meaning: 'To refuse an offer or request.',
  arabic: 'رفض',
  notes: [],
  sentenceArabic: 'رفضوا العرض.',
  examples: ['She turned down the job.', 'He turned the invitation down.'],
  combinations: [],
  otherMeanings: [{ meaning: 'To reduce the volume or power of something.', arabic: 'خفّض' }],
};

describe('validateDictionary', () => {
  it('accepts a well-formed card', () => {
    const r = validateDictionary(good, passage, [3]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.kind).toBe('word');
      expect(r.card.unitIndices).toEqual([3, 6]);
      expect(r.card.headword).toBe('turn down');
    }
  });

  it('trims lists that are too long instead of rejecting', () => {
    const r = validateDictionary(
      {
        ...good,
        notes: ['a', 'b', 'c'],
        combinations: Array.from({ length: 10 }, (_, i) => `combo ${i}`),
        examples: ['one', 'two', 'three'],
        otherMeanings: Array.from({ length: 6 }, (_, i) => ({ meaning: `m${i}`, arabic: 'معنى' })),
      },
      passage,
      [3],
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.notes).toHaveLength(2);
      expect(r.card.combinations).toHaveLength(6);
      expect(r.card.examples).toHaveLength(2);
      expect(r.card.otherMeanings).toHaveLength(4);
    }
  });

  it('drops blank list entries and trims strings', () => {
    const r = validateDictionary({ ...good, notes: ['', '  ', ' real note '], headword: '  turn down ' }, passage, [3]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.notes).toEqual(['real note']);
      expect(r.card.headword).toBe('turn down');
    }
  });

  it('rejects when an Arabic field has no Arabic script', () => {
    expect(validateDictionary({ ...good, arabic: 'refuse' }, passage, [3]).ok).toBe(false);
    expect(validateDictionary({ ...good, sentenceArabic: 'They refused.' }, passage, [3]).ok).toBe(false);
  });

  it('rejects when the unit does not include the selected word', () => {
    const r = validateDictionary({ ...good, unitIndices: [4, 5] }, passage, [3]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/selected/i);
  });

  it('rejects missing or empty required fields', () => {
    const { meaning: _m, ...noMeaning } = good;
    expect(validateDictionary(noMeaning, passage, [3]).ok).toBe(false);
    expect(validateDictionary({ ...good, examples: [] }, passage, [3]).ok).toBe(false);
    expect(validateDictionary({ ...good, headword: '' }, passage, [3]).ok).toBe(false);
    expect(validateDictionary(null, passage, [3]).ok).toBe(false);
    expect(validateDictionary('nope', passage, [3]).ok).toBe(false);
  });

  it('drops other meanings whose Arabic is missing', () => {
    const r = validateDictionary(
      { ...good, otherMeanings: [{ meaning: 'ok', arabic: 'حسن' }, { meaning: 'bad', arabic: '' }] },
      passage,
      [3],
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.otherMeanings).toEqual([{ meaning: 'ok', arabic: 'حسن' }]);
  });
});

// The(1) deal(2) fell(3) through(4) at(5) the(6) last(7) minute(8)
const tPassage = buildSentencePassage('The deal fell through at the last minute.');
const tGood = {
  arabic: 'فشلت الصفقة في اللحظة الأخيرة.',
  plainEnglish: '',
  keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'To fail to happen.', arabic: 'فشل' }],
};

describe('validateTranslation', () => {
  it('accepts a translation card and allows empty plain English', () => {
    const r = validateTranslation(tGood, tPassage);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.kind).toBe('sentence');
      expect(r.card.plainEnglish).toBe('');
      expect(r.card.keyExpressions).toHaveLength(1);
    }
  });

  it('drops key expressions with invalid indices and trims to three', () => {
    const ke = (i: number[]) => ({ expression: 'x', indices: i, meaning: 'm', arabic: 'ع' });
    const r = validateTranslation({ ...tGood, keyExpressions: [ke([1]), ke([99]), ke([2]), ke([3]), ke([4])] }, tPassage);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.keyExpressions.map((k) => k.indices)).toEqual([[1], [2], [3]]);
  });

  it('drops key expressions whose Arabic is not Arabic', () => {
    const r = validateTranslation(
      { ...tGood, keyExpressions: [{ expression: 'x', indices: [1], meaning: 'm', arabic: 'latin' }] },
      tPassage,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.keyExpressions).toEqual([]);
  });

  it('rejects when the translation is empty or not Arabic', () => {
    expect(validateTranslation({ ...tGood, arabic: '' }, tPassage).ok).toBe(false);
    expect(validateTranslation({ ...tGood, arabic: 'The deal failed.' }, tPassage).ok).toBe(false);
  });
});

describe('validateSummary', () => {
  it('accepts english and arabic text', () => {
    const r = validateSummary({ english: 'An article about things.', arabic: 'مقال عن أشياء.' });
    expect(r.ok).toBe(true);
  });

  it('rejects missing or non-Arabic fields', () => {
    expect(validateSummary({ english: 'x', arabic: 'not arabic' }).ok).toBe(false);
    expect(validateSummary({ english: '', arabic: 'عربي' }).ok).toBe(false);
    expect(validateSummary({}).ok).toBe(false);
  });
});
