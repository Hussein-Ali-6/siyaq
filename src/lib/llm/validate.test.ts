import { describe, expect, it } from 'vitest';
import { buildSentencePassage } from '@/lib/text/tokens';
import * as validate from '@/lib/llm/validate';
import type { Passage } from '@/lib/types';

// The older tests below check Arabic, the language Siyaq started with.
const validateDictionary = (raw: unknown, p: Passage, selected: number[], language = 'ar') => validate.validateDictionary(raw, p, selected, language);
const validateTranslation = (raw: unknown, p: Passage, language = 'ar') => validate.validateTranslation(raw, p, language);
const validateSummary = (raw: unknown, language = 'ar') => validate.validateSummary(raw, language);

// Before(1) They(2) turned(3) the(4) offer(5) down(6) After(7)
const passage = buildSentencePassage('Before. They turned the offer down. After.');

const good = {
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  ipaUk: 'ˌtɜːn ˈdaʊn',
  ipaUs: 'ˌtɝːn ˈdaʊn',
  unitIndices: [3, 6],
  meaning: 'To refuse an offer or request.',
  translation: 'رفض',
  notes: [],
  sentenceTranslation: 'رفضوا العرض.',
  examples: ['She turned down the job.', 'He turned the invitation down.'],
  combinations: [],
  otherMeanings: [{ meaning: 'To reduce the volume or power of something.', translation: 'خفّض' }],
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
        headword: 'refuse',
        notes: ['a', 'b', 'c'],
        combinations: Array.from({ length: 10 }, (_, i) => `combo ${i}`),
        examples: ['one', 'two', 'three'],
        otherMeanings: Array.from({ length: 6 }, (_, i) => ({ meaning: `m${i}`, translation: 'معنى' })),
      },
      passage,
      [3],
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.notes).toEqual(['a', 'b', 'c']);
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
    expect(validateDictionary({ ...good, translation: 'refuse' }, passage, [3]).ok).toBe(false);
    expect(validateDictionary({ ...good, sentenceTranslation: 'They refused.' }, passage, [3]).ok).toBe(false);
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

  it('keeps combinations the model gives for a multi-word headword', () => {
    const r = validateDictionary({ ...good, headword: 'chilling effect', combinations: ['have a chilling effect'] }, passage, [3]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.combinations).toEqual(['have a chilling effect']);
  });

  it('accepts an Arabic field that adds a short clarification', () => {
    const arabic = 'قلّة قليلة (أي أن معظمهم لم يصدّق)';
    const r = validateDictionary({ ...good, translation: arabic }, passage, [3]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.translation).toBe(arabic);
  });

  it('keeps the British and American IPA without surrounding slashes or brackets', () => {
    const r = validateDictionary({ ...good, ipaUk: ' /ˌtɜːn ˈdaʊn/ ', ipaUs: '[ˌtɝːn ˈdaʊn]' }, passage, [3]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.ipaUk).toBe('ˌtɜːn ˈdaʊn');
      expect(r.card.ipaUs).toBe('ˌtɝːn ˈdaʊn');
    }
  });

  it('treats a missing or implausibly long IPA as empty instead of rejecting the card', () => {
    const { ipaUk: _uk, ...noUk } = good;
    const r = validateDictionary({ ...noUk, ipaUs: 'x'.repeat(120) }, passage, [3]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.ipaUk).toBe('');
      expect(r.card.ipaUs).toBe('');
    }
  });

  it('rejects an empty Arabic field', () => {
    expect(validateDictionary({ ...good, translation: '' }, passage, [3]).ok).toBe(false);
  });

  it('keeps combinations for a single-word headword', () => {
    const r = validateDictionary({ ...good, headword: 'decision', combinations: ['make a decision'] }, passage, [3]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.combinations).toEqual(['make a decision']);
  });

  it('drops other meanings whose Arabic is missing', () => {
    const r = validateDictionary(
      { ...good, otherMeanings: [{ meaning: 'ok', translation: 'حسن' }, { meaning: 'bad', translation: '' }] },
      passage,
      [3],
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.otherMeanings).toEqual([{ meaning: 'ok', translation: 'حسن' }]);
  });
});

// The(1) deal(2) fell(3) through(4) at(5) the(6) last(7) minute(8)
const tPassage = buildSentencePassage('The deal fell through at the last minute.');
const tGood = {
  translation: 'فشلت الصفقة في اللحظة الأخيرة.',
  plainEnglish: '',
  keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'To fail to happen.', translation: 'فشل' }],
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
    const ke = (i: number[]) => ({ expression: 'x', indices: i, meaning: 'm', translation: 'ع' });
    const r = validateTranslation({ ...tGood, keyExpressions: [ke([1]), ke([99]), ke([2]), ke([3]), ke([4])] }, tPassage);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.keyExpressions.map((k) => k.indices)).toEqual([[1], [2], [3]]);
  });

  it('drops key expressions whose Arabic is not Arabic', () => {
    const r = validateTranslation(
      { ...tGood, keyExpressions: [{ expression: 'x', indices: [1], meaning: 'm', translation: 'latin' }] },
      tPassage,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.card.keyExpressions).toEqual([]);
  });

  it('rejects when the translation is empty or not Arabic', () => {
    expect(validateTranslation({ ...tGood, translation: '' }, tPassage).ok).toBe(false);
    expect(validateTranslation({ ...tGood, translation: 'The deal failed.' }, tPassage).ok).toBe(false);
  });
});

describe('validateSummary', () => {
  it('accepts english and arabic text', () => {
    const r = validateSummary({ english: 'An article about things.', translation: 'مقال عن أشياء.' });
    expect(r.ok).toBe(true);
  });

  it('rejects missing or non-Arabic fields', () => {
    expect(validateSummary({ english: 'x', translation: 'not arabic' }).ok).toBe(false);
    expect(validateSummary({ english: '', translation: 'عربي' }).ok).toBe(false);
    expect(validateSummary({}).ok).toBe(false);
  });
});

describe('translation language rules', () => {
  const spanish = {
    ...good,
    translation: 'rechazar',
    sentenceTranslation: 'Rechazaron la oferta.',
    otherMeanings: [{ meaning: 'To reduce the volume.', translation: 'bajar' }],
  };

  it('records the language on every result', () => {
    const d = validateDictionary(good, passage, [3]);
    const t = validateTranslation(tGood, tPassage);
    const s = validateSummary({ english: 'A summary.', translation: 'ملخص.' });
    expect(d.ok && d.card.language).toBe('ar');
    expect(t.ok && t.card.language).toBe('ar');
    expect(s.ok && s.card.language).toBe('ar');
  });

  it('accepts Latin-script languages without a script check, but not empty text', () => {
    expect(validateDictionary(spanish, passage, [3], 'es').ok).toBe(true);
    expect(validateDictionary({ ...spanish, translation: ' ' }, passage, [3], 'es').ok).toBe(false);
    const { sentenceTranslation: _s, ...missing } = spanish;
    expect(validateDictionary(missing, passage, [3], 'es').ok).toBe(false);
  });

  it('checks the script of languages that have their own', () => {
    expect(validateSummary({ english: 'A summary.', translation: '要約です。' }, 'ja').ok).toBe(true);
    expect(validateSummary({ english: 'A summary.', translation: 'A summary.' }, 'ja').ok).toBe(false);
    expect(validateSummary({ english: 'A summary.', translation: 'خلاصه.' }, 'fa').ok).toBe(true);
    expect(validateSummary({ english: 'A summary.', translation: 'Краткое содержание.' }, 'ar').ok).toBe(false);
  });

  it('says which language a rejected field must be in', () => {
    const r = validateSummary({ english: 'A summary.', translation: 'A summary.' }, 'ko');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('translation: must be written in Korean');
  });

  it('only asks a typed language for non-empty text', () => {
    expect(validateSummary({ english: 'A summary.', translation: 'Kurteyek.' }, 'x:Kurdish').ok).toBe(true);
    expect(validateSummary({ english: 'A summary.', translation: '' }, 'x:Kurdish').ok).toBe(false);
  });
});

describe('English only', () => {
  it('leaves translation fields out of a word card, even when the model sent them', () => {
    const r = validateDictionary(good, passage, [3], 'none');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.language).toBe('none');
      expect(r.card).not.toHaveProperty('translation');
      expect(r.card).not.toHaveProperty('sentenceTranslation');
      expect(r.card.otherMeanings).toEqual([{ meaning: 'To reduce the volume or power of something.' }]);
    }
  });

  it('accepts a word card that has no translation fields', () => {
    const { translation: _t, sentenceTranslation: _s, ...bare } = good;
    expect(validateDictionary({ ...bare, otherMeanings: [{ meaning: 'Another sense.' }] }, passage, [3], 'none').ok).toBe(true);
  });

  it('requires the plainer English of a sentence card and drops translations', () => {
    expect(validateTranslation(tGood, tPassage, 'none').ok).toBe(false);
    const r = validateTranslation({ ...tGood, plainEnglish: 'The deal failed at the last moment.' }, tPassage, 'none');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card).not.toHaveProperty('translation');
      expect(r.card.keyExpressions).toEqual([{ expression: 'fell through', indices: [3, 4], meaning: 'To fail to happen.' }]);
    }
  });

  it('keeps only the English summary', () => {
    expect(validateSummary({ english: 'A summary.', translation: 'ملخص.' }, 'none')).toEqual({
      ok: true,
      card: { language: 'none', english: 'A summary.' },
    });
  });
});

describe('Chinese punctuation', () => {
  const chinese = {
    ...good,
    translation: '拒绝;回绝',
    sentenceTranslation: '会面后,他们拒绝了这个提议。',
    otherMeanings: [{ meaning: 'To reduce the volume or power of something.', translation: '调低(音量、温度等)' }],
  };

  it('gives every translation field of a Chinese word card full-width punctuation', () => {
    for (const language of ['zh-Hans', 'zh-Hant']) {
      const r = validateDictionary(chinese, passage, [3], language);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.card.translation).toBe('拒绝；回绝');
      expect(r.card.sentenceTranslation).toBe('会面后，他们拒绝了这个提议。');
      expect(r.card.otherMeanings).toEqual([{ meaning: 'To reduce the volume or power of something.', translation: '调低（音量、温度等）' }]);
    }
  });

  it('does the same for a Chinese sentence card and its key expressions', () => {
    const r = validateTranslation(
      {
        translation: '交易在最后一刻告吹了,没有人感到意外。',
        plainEnglish: 'The deal failed, and nobody was surprised.',
        keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'To fail to happen.', translation: '告吹;落空' }],
      },
      tPassage,
      'zh-Hans',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.card.translation).toBe('交易在最后一刻告吹了，没有人感到意外。');
    expect(r.card.keyExpressions[0]?.translation).toBe('告吹；落空');
    expect(r.card.plainEnglish).toBe('The deal failed, and nobody was surprised.');
  });

  it('does the same for a Chinese summary, and leaves its English alone', () => {
    const r = validateSummary({ english: 'A bakery, a chain (and an offer).', translation: '一家面包店,一家连锁企业(和一份提议)。' }, 'zh-Hans');
    expect(r).toEqual({
      ok: true,
      card: { language: 'zh-Hans', english: 'A bakery, a chain (and an offer).', translation: '一家面包店，一家连锁企业（和一份提议）。' },
    });
  });

  it('leaves the punctuation of other languages as the model wrote it', () => {
    const japanese = validateSummary({ english: 'A summary.', translation: '要約です,たぶん。' }, 'ja');
    expect(japanese.ok && japanese.card.translation).toBe('要約です,たぶん。');
    const spanish = validateSummary({ english: 'A summary.', translation: 'Un resumen, quizá (hoy).' }, 'es');
    expect(spanish.ok && spanish.card.translation).toBe('Un resumen, quizá (hoy).');
    const typed = validateSummary({ english: 'A summary.', translation: '摘要,也许。' }, 'x:Cantonese');
    expect(typed.ok && typed.card.translation).toBe('摘要,也许。');
  });
});
