import { describe, expect, it } from 'vitest';
import { buildWordPassage } from '@/lib/text/tokens';
import { performLookup, type LookupDeps } from '@/lib/claude/lookup';
import { ClaudeError } from '@/lib/claude/client';
import type { Card, LookupRequest } from '@/lib/types';

const page = { url: 'https://example.com/a', title: 'A title', siteName: 'Example' };

function wordRequest(): LookupRequest {
  const text = 'Before. They turned the offer down. After.';
  const s = text.indexOf('turned');
  const { passage, selectedIndices } = buildWordPassage(text, { start: s, end: s + 6 });
  return { kind: 'word', page, paragraph: 'Some paragraph text.', selection: 'turned', passage, selectedIndices };
}

const goodAnswer = {
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  unitIndices: [3, 6],
  meaning: 'To refuse an offer or request.',
  arabic: 'رفض',
  notes: [],
  sentenceArabic: 'رفضوا العرض.',
  examples: ['She turned down the job.', 'He turned the invitation down.'],
  combinations: [],
  otherMeanings: [],
};

function fakeDeps(answers: Array<unknown | Error>): LookupDeps & { calls: number; store: Map<string, Card> } {
  const store = new Map<string, Card>();
  const deps = {
    calls: 0,
    store,
    client: {
      async callStructured() {
        const next = answers[deps.calls++];
        if (next instanceof Error) throw next;
        return { json: next, stopReason: 'end_turn' };
      },
      async ping() {},
    },
    cache: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, card: Card) => {
        store.set(key, card);
      },
    },
    getSummary: async () => null,
    retryDelayMs: 0,
  };
  return deps;
}

describe('performLookup', () => {
  it('returns a validated card and caches it', async () => {
    const deps = fakeDeps([goodAnswer]);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.cached).toBe(false);
      expect(res.card.kind).toBe('word');
    }
    expect(deps.calls).toBe(1);
    expect(deps.store.size).toBe(1);
  });

  it('serves a repeat request from the cache without calling the model', async () => {
    const deps = fakeDeps([goodAnswer]);
    await performLookup(wordRequest(), deps);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok && res.cached).toBe(true);
    expect(deps.calls).toBe(1);
  });

  it('retries once when the first answer is unusable', async () => {
    const deps = fakeDeps([{ ...goodAnswer, unitIndices: [4, 5] }, goodAnswer]);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok).toBe(true);
    expect(deps.calls).toBe(2);
  });

  it('gives up after the retry', async () => {
    const deps = fakeDeps([{ ...goodAnswer, arabic: 'latin' }, { ...goodAnswer, arabic: 'latin' }]);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_answer');
    expect(deps.calls).toBe(2);
    expect(deps.store.size).toBe(0);
  });

  it('retries once on a retryable API error and then reports it', async () => {
    const deps = fakeDeps([new ClaudeError('overloaded', 'Overloaded', 529), new ClaudeError('overloaded', 'Overloaded', 529)]);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('overloaded');
    expect(deps.calls).toBe(2);
  });

  it('does not retry on a bad key', async () => {
    const deps = fakeDeps([new ClaudeError('bad_key', 'Invalid key', 401)]);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('bad_key');
    expect(deps.calls).toBe(1);
  });

  it('refuses a selection that is too long', async () => {
    const deps = fakeDeps([]);
    const req: LookupRequest = { ...wordRequest(), kind: 'sentence', selection: Array(401).fill('word').join(' ') };
    const res = await performLookup(req, deps);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('too_long');
    expect(deps.calls).toBe(0);
  });
});
