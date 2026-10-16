import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '@/lib/storage/url';
import { sha256Hex } from '@/lib/storage/hash';

describe('normalizeUrl', () => {
  it('drops the fragment and tracking parameters, lowercases the host', () => {
    expect(normalizeUrl('https://Example.com/a/b?utm_source=x&id=5#frag')).toBe('https://example.com/a/b?id=5');
    expect(normalizeUrl('https://example.com/a/?fbclid=1&gclid=2')).toBe('https://example.com/a/');
  });

  it('keeps ordinary query strings', () => {
    expect(normalizeUrl('https://example.com/post?p=12')).toBe('https://example.com/post?p=12');
  });

  it('returns invalid input unchanged', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});

describe('sha256Hex', () => {
  it('hashes text to lowercase hex', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
