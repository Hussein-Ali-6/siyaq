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
