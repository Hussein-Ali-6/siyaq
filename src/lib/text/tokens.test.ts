import { describe, expect, it } from 'vitest';
import {
  buildNumberedPassage,
  buildSentencePassage,
  buildWordPassage,
  segmentSentences,
  selectedTokenIndices,
  sentenceSegments,
  sentenceWindow,
  sentenceWindowByWords,
  surfaceForm,
  tokenizeWords,
  validateIndices,
} from '@/lib/text/tokens';

describe('segmentSentences', () => {
  it('splits English sentences and trims whitespace', () => {
    const text = 'First one. Second one here!  Third?';
    const spans = segmentSentences(text).map((s) => text.slice(s.start, s.end));
    expect(spans).toEqual(['First one.', 'Second one here!', 'Third?']);
  });

  it('does not break at soft line breaks inside a sentence', () => {
    const text = 'The committee\n   turned the offer down. Then it adjourned.';
    const spans = segmentSentences(text);
    expect(spans).toHaveLength(2);
    expect(text.slice(spans[0]!.start, spans[0]!.end)).toBe('The committee\n   turned the offer down.');
  });

  it('keeps common abbreviations inside a sentence', () => {
    const text = 'Dr. Smith arrived late. He apologised.';
    const spans = segmentSentences(text).map((s) => text.slice(s.start, s.end));
    expect(spans).toEqual(['Dr. Smith arrived late.', 'He apologised.']);
  });

  it('returns one span for text without sentence punctuation', () => {
    const text = 'A heading without a full stop';
    expect(segmentSentences(text)).toEqual([{ start: 0, end: text.length }]);
  });
});

describe('tokenizeWords', () => {
  it('numbers word-like tokens from 1 and records offsets', () => {
    const text = "Don't turn it down, Dr. Smith.";
    const tokens = tokenizeWords(text);
    expect(tokens.map((t) => t.t)).toEqual(["Don't", 'turn', 'it', 'down', 'Dr', 'Smith']);
    expect(tokens[0]).toEqual({ i: 1, t: "Don't", start: 0, end: 5 });
    expect(tokens[3]).toEqual({ i: 4, t: 'down', start: 14, end: 18 });
  });

  it('ignores bracketed footnote numbers so they are not numbered as words', () => {
    const tokens = tokenizeWords('Great work has a tincture[2] of strangeness. [3] Four steps.');
    expect(tokens.map((t) => t.t)).toEqual(['Great', 'work', 'has', 'a', 'tincture', 'of', 'strangeness', 'Four', 'steps']);
  });

  it('supports a base offset and a starting index', () => {
    const tokens = tokenizeWords('ab cd', 10, 5);
    expect(tokens).toEqual([
      { i: 5, t: 'ab', start: 10, end: 12 },
      { i: 6, t: 'cd', start: 13, end: 15 },
    ]);
  });
});

describe('buildNumberedPassage', () => {
  it('prefixes each token with its index and keeps punctuation', () => {
    const passage = buildSentencePassage('They turned the offer down, surprisingly.');
    expect(buildNumberedPassage(passage)).toBe('[1]They [2]turned [3]the [4]offer [5]down, [6]surprisingly.');
  });

  it('collapses runs of whitespace', () => {
    const passage = buildSentencePassage('Hello\n   world');
    expect(buildNumberedPassage(passage)).toBe('[1]Hello [2]world');
  });
});

describe('sentenceWindow', () => {
  const text = 'One is here. Two is the target sentence. Three follows it. Four is far away.';

  it('returns the sentence containing the selection plus one on each side', () => {
    const s = text.indexOf('target');
    const { window, sentence } = sentenceWindow(text, { start: s, end: s + 6 });
    expect(text.slice(sentence.start, sentence.end)).toBe('Two is the target sentence.');
    expect(text.slice(window.start, window.end)).toBe(
      'One is here. Two is the target sentence. Three follows it.',
    );
  });

  it('clamps at the edges of the text', () => {
    const { window, sentence } = sentenceWindow(text, { start: 0, end: 3 });
    expect(text.slice(sentence.start, sentence.end)).toBe('One is here.');
    expect(text.slice(window.start, window.end)).toBe('One is here. Two is the target sentence.');
  });

  it('falls back to the whole text when it has no sentences', () => {
    const { window, sentence } = sentenceWindow('   ', { start: 1, end: 2 });
    expect(window).toEqual({ start: 0, end: 3 });
    expect(sentence).toEqual({ start: 0, end: 3 });
  });
});

describe('buildWordPassage', () => {
  const text = 'One is here. Two is the target sentence. Three follows it. Four is far away.';

  it('numbers the window and marks the selected tokens', () => {
    const s = text.indexOf('target');
    const { passage, windowStart, selectedIndices } = buildWordPassage(text, { start: s, end: s + 6 });
    expect(windowStart).toBe(0);
    expect(passage.text).toBe('One is here. Two is the target sentence. Three follows it.');
    // One(1) is(2) here(3) Two(4) is(5) the(6) target(7)
    expect(selectedIndices).toEqual([7]);
    expect(passage.sentence).toEqual({ start: 13, end: 40 });
  });

  it('shifts offsets when the window does not start at zero', () => {
    const s = text.indexOf('far');
    const { passage, windowStart, selectedIndices } = buildWordPassage(text, { start: s, end: s + 3 });
    expect(windowStart).toBe(text.indexOf('Three'));
    expect(passage.text).toBe('Three follows it. Four is far away.');
    expect(passage.tokens[0]).toEqual({ i: 1, t: 'Three', start: 0, end: 5 });
    expect(selectedIndices).toEqual([6]);
  });

  it('marks every word of a multi-word selection', () => {
    const s = text.indexOf('the target');
    const { selectedIndices } = buildWordPassage(text, { start: s, end: s + 'the target'.length });
    expect(selectedIndices).toEqual([6, 7]);
  });
});

describe('selectedTokenIndices', () => {
  it('returns tokens overlapping the span, even partially', () => {
    const p = buildSentencePassage('turned the offer down');
    expect(selectedTokenIndices(p.tokens, { start: 2, end: 9 })).toEqual([1, 2]);
  });

  it('returns nothing for a span on whitespace only', () => {
    const p = buildSentencePassage('turned the offer down');
    expect(selectedTokenIndices(p.tokens, { start: 6, end: 7 })).toEqual([]);
  });
});

describe('validateIndices', () => {
  const passage = buildSentencePassage('They turned the offer down yesterday.');

  it('accepts indices that are in range and overlap the selection', () => {
    expect(validateIndices([2, 5], passage, [2])).toEqual({ ok: true, indices: [2, 5] });
  });

  it('sorts and dedupes', () => {
    expect(validateIndices([5, 2, 2], passage, [2])).toEqual({ ok: true, indices: [2, 5] });
  });

  it('rejects indices outside the passage', () => {
    expect(validateIndices([2, 9], passage, [2]).ok).toBe(false);
    expect(validateIndices([0], passage, [2]).ok).toBe(false);
  });

  it('rejects a unit that does not include a selected word', () => {
    expect(validateIndices([3, 4], passage, [2]).ok).toBe(false);
  });

  it('rejects empty or non-integer input', () => {
    expect(validateIndices([], passage, [2]).ok).toBe(false);
    expect(validateIndices(['2'], passage, [2]).ok).toBe(false);
    expect(validateIndices([2.5], passage, [2]).ok).toBe(false);
    expect(validateIndices('2', passage, [2]).ok).toBe(false);
  });

  it('accepts any valid indices when there is no selection anchor', () => {
    expect(validateIndices([3], passage, [])).toEqual({ ok: true, indices: [3] });
  });
});

describe('sentenceSegments', () => {
  it('bolds the unit tokens inside the sentence', () => {
    const text = 'Before. They turned the offer down. After.';
    const s = text.indexOf('turned');
    const { passage } = buildWordPassage(text, { start: s, end: s + 6 });
    // Before(1) They(2) turned(3) the(4) offer(5) down(6) After(7)
    expect(sentenceSegments(passage, [3, 6])).toEqual([
      { text: 'They ' },
      { text: 'turned', bold: true },
      { text: ' the offer ' },
      { text: 'down', bold: true },
      { text: '.' },
    ]);
  });

  it('uses the whole passage when there is no sentence span', () => {
    const passage = buildSentencePassage('Fell through.');
    expect(sentenceSegments(passage, [1])).toEqual([{ text: 'Fell', bold: true }, { text: ' through.' }]);
  });
});

describe('surfaceForm', () => {
  const passage = buildSentencePassage('They turned the offer down.');

  it('joins adjacent unit words with spaces', () => {
    expect(surfaceForm(passage, [3, 4])).toBe('the offer');
    expect(surfaceForm(passage, [2])).toBe('turned');
  });

  it('marks gaps with an ellipsis', () => {
    expect(surfaceForm(passage, [2, 5])).toBe('turned … down');
  });
});

describe('sentenceWindowByWords', () => {
  const sentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} has exactly seven words.`);
  const text = sentences.join(' ');

  it('grows around the selection until the minimum, alternating after then before', () => {
    const s = text.indexOf('Sentence number 20');
    const span = sentenceWindowByWords(text, { start: s, end: s + 8 }, { min: 50, max: 100 });
    const chunk = text.slice(span.start, span.end);
    expect(chunk).toContain('Sentence number 20');
    expect(chunk.startsWith('Sentence number 17')).toBe(true);
    expect(chunk.endsWith('Sentence number 24 has exactly seven words.')).toBe(true);
  });

  it('never grows past the maximum', () => {
    const s = text.indexOf('Sentence number 20');
    const span = sentenceWindowByWords(text, { start: s, end: s + 8 }, { min: 150, max: 160 });
    const words = text.slice(span.start, span.end).split(' ').length;
    expect(words).toBeLessThanOrEqual(160);
    expect(words).toBeGreaterThanOrEqual(150);
  });

  it('keeps the whole selection sentence even when it alone exceeds the maximum', () => {
    const long = Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ') + '.';
    const span = sentenceWindowByWords(long, { start: 0, end: 2 }, { min: 10, max: 20 });
    expect(span).toEqual({ start: 0, end: long.length });
  });
});
