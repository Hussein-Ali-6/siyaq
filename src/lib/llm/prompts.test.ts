import { describe, expect, it } from 'vitest';
import { buildSentencePassage, buildWordPassage } from '@/lib/text/tokens';
import {
  dictionarySystem,
  dictionaryUserMessage,
  pageContextBlock,
  summarySystem,
  summaryUserMessage,
  translationSystem,
  translationUserMessage,
  type Reader,
} from '@/lib/llm/prompts';
import type { LookupRequest } from '@/lib/types';

const page = { url: 'https://example.com/a', title: 'A title', siteName: 'Example' };

function wordRequest(): LookupRequest {
  const text = 'Before. They turned the offer down. After.';
  const s = text.indexOf('turned');
  const { passage, selectedIndices } = buildWordPassage(text, { start: s, end: s + 6 });
  return { kind: 'word', page, paragraph: 'Some paragraph text.', selection: 'turned', passage, selectedIndices };
}

const arabicC1: Reader = { language: 'ar', level: 'C1' };
const spanishB2: Reader = { language: 'es', level: 'B2' };

describe('system prompts', () => {
  it('are long enough to be cached and contain worked examples with empty lists', () => {
    const dictionary = dictionarySystem(arabicC1);
    expect(dictionary.length).toBeGreaterThan(3000);
    expect(dictionary).toContain('"notes": []');
    expect(dictionary).toContain('"ipaUk"');
    expect(dictionary).toContain('"ipaUs"');
    expect(dictionary).toContain('"combinations": []');
    expect(translationSystem(arabicC1)).toContain('"keyExpressions": []');
    expect(translationSystem(arabicC1)).toContain('"plainEnglish": ""');
    expect(summarySystem('ar').length).toBeGreaterThan(200);
  });

  it('describe the reader from the settings', () => {
    expect(dictionarySystem(spanishB2)).toContain('a native speaker of Spanish who reads English at about B2 level');
    expect(translationSystem({ language: 'x:Kurdish', level: 'B1' })).toContain('a native speaker of Kurdish who reads English at about B1 level');
    expect(dictionarySystem({ language: 'none', level: 'C1' })).toContain('wants explanations in English only');
  });

  it('open naturally for a reader who chose English only', () => {
    const dictionary = dictionarySystem({ language: 'none', level: 'C1' });
    const sentence = translationSystem({ language: 'none', level: 'B2' });
    expect(dictionary).toContain(
      'a context-aware English dictionary for one reader: someone who reads English at about C1 level and wants explanations in English only. While reading',
    );
    expect(sentence).toContain(
      'a reading helper for one reader: someone who reads English at about B2 level and wants explanations in English only. While reading',
    );
    for (const text of [dictionary, sentence]) expect(text).not.toContain('a reader who reads');
  });

  it('use a name that reads well in a sentence for a language whose list name has brackets', () => {
    const reader: Reader = { language: 'zh-Hans', level: 'B2' };
    const dictionary = dictionarySystem(reader);
    const sentence = translationSystem(reader);
    const summary = summarySystem('zh-Hans');
    expect(dictionary).toContain('a native speaker of Simplified Chinese who reads English at about B2 level');
    expect(dictionary).toContain('- translation: the Simplified Chinese for this sense');
    expect(sentence).toContain('as a skilled Simplified Chinese writer would express the same meaning');
    expect(summary).toContain('the same summary in natural Simplified Chinese, as a skilled Simplified Chinese writer would put it');
    for (const text of [dictionary, sentence, summary]) expect(text).not.toContain('Chinese (Simplified)');
    expect(summarySystem('pt-BR')).toContain('a native speaker of Brazilian Portuguese');
  });

  it('name the language in the field rules and ask for its written standard', () => {
    expect(dictionarySystem(spanishB2)).toContain('- translation: the Spanish for this sense');
    expect(dictionarySystem(spanishB2)).toContain('- sentenceTranslation: a natural Spanish translation');
    expect(translationSystem(arabicC1)).toContain('in Modern Standard Arabic');
    expect(translationSystem({ language: 'es', level: 'C1' })).not.toContain('Modern Standard');
    expect(summarySystem('ar')).toContain('natural Modern Standard Arabic');
    expect(summarySystem('ja')).toContain('natural Japanese');
  });

  it('contain no Arabic text and no fixed language', () => {
    const all = [dictionarySystem(spanishB2), translationSystem(spanishB2), summarySystem('es')].join('\n');
    expect(all).not.toMatch(/\p{Script=Arabic}/u);
    expect(all).not.toContain('Arabic');
  });

  it('say after the examples that the translation fields are still required', () => {
    expect(dictionarySystem(spanishB2)).toContain('Your answer must include them, written in Spanish');
    expect(translationSystem(spanishB2)).toContain('Your answer must include them, written in Spanish');
  });

  it('ask for the punctuation the translation language uses in print', () => {
    const afterExamples = 'Your answer must include them, written in Spanish, with the punctuation that language uses in print.';
    expect(dictionarySystem(spanishB2).endsWith(afterExamples)).toBe(true);
    expect(translationSystem(spanishB2).endsWith(afterExamples)).toBe(true);
    expect(summarySystem('es')).toContain(
      '- translation: the same summary in natural Spanish, as a skilled Spanish writer would put it, with the punctuation that language uses in print.',
    );
    expect(dictionarySystem(arabicC1)).toContain('written in Arabic, with the punctuation that language uses in print.');
    expect(translationSystem({ language: 'x:Kurdish', level: 'B1' })).toContain('written in Kurdish, with the punctuation that language uses in print.');
  });

  it('say nothing about punctuation in print for English only', () => {
    const reader: Reader = { language: 'none', level: 'B2' };
    for (const text of [dictionarySystem(reader), translationSystem(reader), summarySystem('none')]) {
      expect(text).not.toContain('punctuation that language uses');
      expect(text).not.toContain('in print');
    }
  });

  it('leave translation fields out for English only and always ask for plainer English', () => {
    const dictionary = dictionarySystem({ language: 'none', level: 'B2' });
    const sentence = translationSystem({ language: 'none', level: 'B2' });
    for (const text of [dictionary, sentence, summarySystem('none')]) {
      expect(text).not.toContain('translation:');
      expect(text).not.toContain('sentenceTranslation');
      expect(text).not.toContain('Your answer must include them');
    }
    expect(sentence).toContain('Always give it');
    expect(sentence).not.toContain('"plainEnglish": ""');
  });

  it('keep the original wording for an advanced reader', () => {
    expect(dictionarySystem(arabicC1)).toContain('Most cards have none.');
    expect(dictionarySystem(arabicC1)).toContain('Basic grammar a C1 reader already knows, word history and background facts are not notes');
    expect(translationSystem(arabicC1)).toContain('that a C1 reader could plausibly misread');
    expect(translationSystem(arabicC1)).toContain('Leave it empty when the selection is clear.');
  });

  it('explain more for lower levels', () => {
    expect(translationSystem({ language: 'es', level: 'B1' })).toContain('Always give it');
    expect(translationSystem({ language: 'es', level: 'B1' })).toContain('a B1 reader may not know');
    expect(translationSystem(spanishB2)).toContain('a B2 reader may not know');
    expect(dictionarySystem({ language: 'es', level: 'B1' })).toContain('very common words');
    expect(dictionarySystem({ language: 'es', level: 'B1' })).not.toContain('C1 reader');
  });

  it('return the same text for the same settings', () => {
    expect(dictionarySystem({ language: 'fa', level: 'B1' })).toBe(dictionarySystem({ language: 'fa', level: 'B1' }));
  });
});

describe('pageContextBlock', () => {
  it('includes title and site, and the summary when present', () => {
    const without = pageContextBlock(page, null);
    expect(without).toContain('A title');
    expect(without).toContain('Example');
    expect(without).not.toContain('Summary');
    const withSummary = pageContextBlock(page, { language: 'ar', english: 'The gist.', translation: 'الخلاصة.' });
    expect(withSummary).toContain('The gist.');
  });
});

describe('dictionaryUserMessage', () => {
  it('contains the numbered passage, the selected indices and the paragraph', () => {
    const msg = dictionaryUserMessage(wordRequest());
    expect(msg).toContain('[3]turned');
    expect(msg).toContain('[3]');
    expect(msg).toContain('Some paragraph text.');
    expect(msg).toContain('They turned the offer down.');
  });

  it('appends a retry hint when given', () => {
    expect(dictionaryUserMessage(wordRequest(), 'indices were out of range')).toContain('out of range');
  });
});

describe('translationUserMessage', () => {
  it('contains the numbered selection and the paragraph', () => {
    const passage = buildSentencePassage('The deal fell through.');
    const req: LookupRequest = {
      kind: 'sentence',
      page,
      paragraph: 'Context paragraph.',
      selection: 'The deal fell through.',
      passage,
      selectedIndices: [1, 2, 3, 4],
    };
    const msg = translationUserMessage(req);
    expect(msg).toContain('[3]fell [4]through');
    expect(msg).toContain('Context paragraph.');
  });
});

describe('summaryUserMessage', () => {
  it('contains the article text and title', () => {
    const msg = summaryUserMessage({ title: 'T', siteName: 'S', text: 'Body of the article.' });
    expect(msg).toContain('Body of the article.');
    expect(msg).toContain('T');
  });
});
