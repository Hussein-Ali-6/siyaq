import { describe, expect, it } from 'vitest';
import { pickVoice, speechChunks, type VoiceLike } from '@/lib/speech';

const v = (name: string, lang: string): VoiceLike => ({ name, lang });

const chromeVoices = [
  v('Samantha', 'en-US'),
  v('Daniel', 'en-GB'),
  v('Google US English', 'en-US'),
  v('Google UK English Male', 'en-GB'),
  v('Google UK English Female', 'en-GB'),
  v('Google Deutsch', 'de-DE'),
];

describe('pickVoice', () => {
  it("prefers Google's own voice for each accent", () => {
    expect(pickVoice(chromeVoices, 'us')?.name).toBe('Google US English');
    expect(pickVoice(chromeVoices, 'uk')?.name).toBe('Google UK English Female');
  });

  it('falls back to any voice for the right region', () => {
    const local = [v('Samantha', 'en-US'), v('Daniel', 'en-GB')];
    expect(pickVoice(local, 'us')?.name).toBe('Samantha');
    expect(pickVoice(local, 'uk')?.name).toBe('Daniel');
  });

  it('accepts underscores in language tags', () => {
    expect(pickVoice([v('Android UK', 'en_GB')], 'uk')?.name).toBe('Android UK');
  });

  it('falls back to any English voice, then to nothing', () => {
    expect(pickVoice([v('Karen', 'en-AU')], 'uk')?.name).toBe('Karen');
    expect(pickVoice([v('Google Deutsch', 'de-DE')], 'us')).toBeNull();
  });
});

describe('speechChunks', () => {
  it('keeps short text as one chunk', () => {
    expect(speechChunks('Turn down')).toEqual(['Turn down']);
  });

  it('splits long text at sentence ends so long readings do not get cut off', () => {
    const sentence = 'This sentence has a reasonable length for reading aloud. ';
    const chunks = speechChunks(sentence.repeat(8), 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 200)).toBe(true);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(sentence.repeat(8).trim().replace(/\s+/g, ' '));
  });

  it('splits a single very long sentence at word boundaries', () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const chunks = speechChunks(long, 100);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(' ')).toBe(long);
  });

  it('returns nothing for blank text', () => {
    expect(speechChunks('   ')).toEqual([]);
  });
});
