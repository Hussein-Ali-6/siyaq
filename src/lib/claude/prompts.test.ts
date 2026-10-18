import { describe, expect, it } from 'vitest';
import { buildSentencePassage, buildWordPassage } from '@/lib/text/tokens';
import {
  DICTIONARY_SYSTEM,
  SUMMARY_SYSTEM,
  TRANSLATION_SYSTEM,
  dictionaryUserMessage,
  pageContextBlock,
  summaryUserMessage,
  translationUserMessage,
} from '@/lib/claude/prompts';
import type { LookupRequest } from '@/lib/types';

const page = { url: 'https://example.com/a', title: 'A title', siteName: 'Example' };

function wordRequest(): LookupRequest {
  const text = 'Before. They turned the offer down. After.';
  const s = text.indexOf('turned');
  const { passage, selectedIndices } = buildWordPassage(text, { start: s, end: s + 6 });
  return { kind: 'word', page, paragraph: 'Some paragraph text.', selection: 'turned', passage, selectedIndices };
}

describe('system prompts', () => {
  it('are long enough to be cached and contain worked examples with empty lists', () => {
    expect(DICTIONARY_SYSTEM.length).toBeGreaterThan(3000);
    expect(DICTIONARY_SYSTEM).toContain('"notes": []');
    expect(DICTIONARY_SYSTEM).not.toContain('arabicMeaning');
    expect(DICTIONARY_SYSTEM).toContain('"ipaUk"');
    expect(DICTIONARY_SYSTEM).toContain('"ipaUs"');
    expect(DICTIONARY_SYSTEM).not.toContain('does not want pronunciation');
    expect(DICTIONARY_SYSTEM).toContain('"combinations": []');
    expect(TRANSLATION_SYSTEM).toContain('"keyExpressions": []');
    expect(TRANSLATION_SYSTEM).toContain('"plainEnglish": ""');
    expect(SUMMARY_SYSTEM.length).toBeGreaterThan(200);
  });
});

describe('pageContextBlock', () => {
  it('includes title and site, and the summary when present', () => {
    const without = pageContextBlock(page, null);
    expect(without).toContain('A title');
    expect(without).toContain('Example');
    expect(without).not.toContain('Summary');
    const withSummary = pageContextBlock(page, { english: 'The gist.', arabic: 'الخلاصة.' });
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
