import { describe, expect, it } from 'vitest';
import { buildWordPassage } from '@/lib/text/tokens';
import { cacheKeyFor, performLookup, type LookupDeps } from '@/lib/llm/lookup';
import { LlmError } from '@/lib/llm/types';
import type { Card, LookupRequest } from '@/lib/types';
import type { Reader } from '@/lib/llm/prompts';

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
  translation: 'رفض',
  notes: [],
  sentenceTranslation: 'رفضوا العرض.',
  examples: ['She turned down the job.', 'He turned the invitation down.'],
  combinations: [],
  otherMeanings: [],
};

function fakeDeps(
  answers: Array<unknown | Error>,
  reader: Reader = { language: 'ar', level: 'C1' },
): LookupDeps & { calls: number; store: Map<string, Card>; systems: string[] } {
  const store = new Map<string, Card>();
  const deps = {
    calls: 0,
    store,
    systems: [] as string[],
    client: {
      async callStructured(args: { system: string }) {
        deps.systems.push(args.system);
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
    reader,
    retryDelayMs: 0,
    modelId: 'anthropic:claude-sonnet-5-5',
  };
  return deps;
}

const arabicC1: Reader = { language: 'ar', level: 'C1' };

describe('cacheKeyFor', () => {
  it('differs between models so one model never reuses another model\'s answer', async () => {
    const req = wordRequest();
    expect(await cacheKeyFor(req, 'anthropic:claude-sonnet-5-5', arabicC1)).not.toBe(await cacheKeyFor(req, 'openai:gpt-x', arabicC1));
    expect(await cacheKeyFor(req, 'openai:gpt-x', arabicC1)).toBe(await cacheKeyFor(req, 'openai:gpt-x', arabicC1));
  });

  it('differs between languages and levels, ignoring the case of the language id', async () => {
    const req = wordRequest();
    const model = 'openai:gpt-x';
    const base = await cacheKeyFor(req, model, arabicC1);
    expect(await cacheKeyFor(req, model, { language: 'es', level: 'C1' })).not.toBe(base);
    expect(await cacheKeyFor(req, model, { language: 'ar', level: 'B1' })).not.toBe(base);
    expect(await cacheKeyFor(req, model, { language: 'x:Kurdish', level: 'B2' })).toBe(await cacheKeyFor(req, model, { language: 'x:kurdish', level: 'B2' }));
  });
});

describe('performLookup', () => {
  it('does not reuse a cached card after the language changes', async () => {
    const spanish = { ...goodAnswer, translation: 'rechazar', sentenceTranslation: 'Rechazaron la oferta.' };
    const deps = fakeDeps([goodAnswer, spanish]);
    await performLookup(wordRequest(), deps);
    deps.reader = { language: 'es', level: 'C1' };
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok && res.cached).toBe(false);
    expect(deps.calls).toBe(2);
  });

  it('asks for the reader\'s language and level and records the language on the card', async () => {
    const spanish = { ...goodAnswer, translation: 'rechazar', sentenceTranslation: 'Rechazaron la oferta.' };
    const deps = fakeDeps([spanish], { language: 'es', level: 'B2' });
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok && res.card.language).toBe('es');
    expect(deps.systems[0]).toContain('a native speaker of Spanish who reads English at about B2 level');
  });

  it('accepts an answer without translations when the reader chose English only', async () => {
    const { translation: _t, sentenceTranslation: _s, ...bare } = goodAnswer;
    const deps = fakeDeps([bare], { language: 'none', level: 'B2' });
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok && res.card.language).toBe('none');
  });

  it('returns a validated card and caches it', async () => {
    const deps = fakeDeps([goodAnswer]);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.cached).toBe(false);
      expect(res.card.kind).toBe('word');
      expect(res.model).toBe('anthropic:claude-sonnet-5-5');
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
    const deps = fakeDeps([{ ...goodAnswer, translation: 'latin' }, { ...goodAnswer, translation: 'latin' }]);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_answer');
    expect(deps.calls).toBe(2);
    expect(deps.store.size).toBe(0);
  });

  it('retries once on a retryable API error and then reports it', async () => {
    const deps = fakeDeps([new LlmError('overloaded', 'Overloaded', 529), new LlmError('overloaded', 'Overloaded', 529)]);
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('overloaded');
    expect(deps.calls).toBe(2);
  });

  it('does not retry on a bad key', async () => {
    const deps = fakeDeps([new LlmError('bad_key', 'Invalid key', 401)]);
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
