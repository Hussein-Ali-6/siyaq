import { describe, expect, it } from 'vitest';
import { oxfordUrl, youglishUrl } from '@/lib/links';

describe('youglishUrl', () => {
  it('opens YouGlish with the word or phrase searched in English', () => {
    expect(youglishUrl('rudder')).toBe('https://youglish.com/pronounce/rudder/english');
    expect(youglishUrl('turn down')).toBe('https://youglish.com/pronounce/turn%20down/english');
  });

  it('encodes characters that would break the path', () => {
    expect(youglishUrl("rock 'n' roll/jazz")).toBe('https://youglish.com/pronounce/rock%20\'n\'%20roll%2Fjazz/english');
  });
});

describe('oxfordUrl', () => {
  it("searches Oxford Learner's Dictionaries", () => {
    expect(oxfordUrl('take for granted')).toBe('https://www.oxfordlearnersdictionaries.com/search/english/?q=take%20for%20granted');
  });
});
