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

describe('classifySelection on non-English text', () => {
  it('ignores Arabic words and sentences', () => {
    expect(classifySelection('كتاب')).toBeNull();
    expect(classifySelection('ذهب أحمد إلى السوق صباح اليوم')).toBeNull();
  });

  it('ignores numbers, symbols and emoji on their own', () => {
    expect(classifySelection('2024')).toBeNull();
    expect(classifySelection('12:30 — 45%')).toBeNull();
    expect(classifySelection('🙂👍')).toBeNull();
  });

  it('ignores other scripts', () => {
    expect(classifySelection('東京')).toBeNull();
    expect(classifySelection('Привет')).toBeNull();
  });

  it('accepts English that contains digits or accented letters', () => {
    expect(classifySelection('COVID-19')).toBe('word');
    expect(classifySelection('café')).toBe('word');
  });

  it('decides mixed selections by which letters are in the majority', () => {
    expect(classifySelection('The word كتاب means book in Arabic')).toBe('sentence');
    expect(classifySelection('ذهب أحمد إلى السوق ثم قال OK')).toBeNull();
  });
});
