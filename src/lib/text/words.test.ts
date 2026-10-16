import { describe, expect, it } from 'vitest';
import { classifySelection, countWords, normalizeWhitespace } from '@/lib/text/words';

describe('countWords', () => {
  it('counts letter and digit runs', () => {
    expect(countWords('turned the offer down')).toBe(4);
    expect(countWords('hello, world!')).toBe(2);
    expect(countWords("don't")).toBe(1);
    expect(countWords('')).toBe(0);
    expect(countWords('...')).toBe(0);
  });
});

describe('classifySelection', () => {
  it('returns null for selections without words', () => {
    expect(classifySelection('')).toBeNull();
    expect(classifySelection('   ')).toBeNull();
    expect(classifySelection('...')).toBeNull();
  });

  it('treats up to four words as a word lookup', () => {
    expect(classifySelection('offer')).toBe('word');
    expect(classifySelection('turned the offer down')).toBe('word');
  });

  it('treats five or more words as a sentence', () => {
    expect(classifySelection('turned the offer down flat')).toBe('sentence');
  });
});

describe('normalizeWhitespace', () => {
  it('collapses runs and trims', () => {
    expect(normalizeWhitespace('  a \n\n b\t c ')).toBe('a b c');
    expect(normalizeWhitespace('a b')).toBe('a b');
  });
});
