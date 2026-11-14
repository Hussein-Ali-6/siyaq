import { describe, expect, it } from 'vitest';
import { summarySchema } from '@/lib/llm/schemas';
import { performSummary, type SummaryDeps } from '@/lib/llm/summary';
import type { Summary } from '@/lib/types';

function fakeDeps(answers: unknown[], delayMs = 0, language = 'ar'): SummaryDeps & { calls: number; store: Map<string, Summary>; schemas: unknown[] } {
  const store = new Map<string, Summary>();
  const deps = {
    calls: 0,
    store,
    schemas: [] as unknown[],
    client: {
      async callStructured(args: { schema: unknown }) {
        deps.schemas.push(args.schema);
        const next = answers[deps.calls++];
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        return { json: next, stopReason: 'end_turn' };
      },
      async ping() {},
    },
    cache: {
      get: async (url: string, lang: string) => store.get(`${url}|${lang}`) ?? null,
      set: async (url: string, lang: string, s: Summary) => {
        store.set(`${url}|${lang}`, s);
      },
    },
    language,
    retryDelayMs: 0,
  };
  return deps;
}

const input = { url: 'https://example.com/a', title: 'T', siteName: 'S', text: 'Article body text.' };
const good = { english: 'A short summary.', translation: 'ملخص قصير.' };

describe('performSummary', () => {
  it('keeps one summary per language', async () => {
    const page = { ...input, url: 'https://example.com/d' };
    const deps = fakeDeps([good, { english: 'A short summary.', translation: 'Un resumen corto.' }]);
    await performSummary(page, deps);
    deps.language = 'es';
    const res = await performSummary(page, deps);
    expect(res.ok && res.cached).toBe(false);
    expect(res.ok && res.summary.language).toBe('es');
    expect(deps.calls).toBe(2);
    expect(deps.store.size).toBe(2);
  });

  it('writes an English-only summary when the reader chose no translation', async () => {
    const deps = fakeDeps([{ english: 'A short summary.' }], 0, 'none');
    const res = await performSummary({ ...input, url: 'https://example.com/e' }, deps);
    expect(res.ok && res.summary).toEqual({ language: 'none', english: 'A short summary.' });
  });

  it('hands the model the answer format with a translation for a translation language', async () => {
    const deps = fakeDeps([good]);
    const res = await performSummary({ ...input, url: 'https://example.com/f' }, deps);
    expect(res.ok).toBe(true);
    expect(deps.schemas[0]).toBe(summarySchema('ar'));
    expect((deps.schemas[0] as { required: string[] }).required).toEqual(['english', 'translation']);
  });

  it('hands the model the answer format without a translation for English only', async () => {
    const deps = fakeDeps([{ english: 'A short summary.' }], 0, 'none');
    const res = await performSummary({ ...input, url: 'https://example.com/g' }, deps);
    expect(res.ok).toBe(true);
    expect(deps.schemas[0]).toBe(summarySchema('none'));
    expect((deps.schemas[0] as { required: string[] }).required).toEqual(['english']);
  });

  it('summarises, validates and caches', async () => {
    const deps = fakeDeps([good]);
    const res = await performSummary(input, deps);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.cached).toBe(false);
    expect(deps.store.size).toBe(1);
    const again = await performSummary(input, deps);
    expect(again.ok && again.cached).toBe(true);
    expect(deps.calls).toBe(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const deps = fakeDeps([good], 20);
    const [a, b] = await Promise.all([performSummary(input, deps), performSummary(input, deps)]);
    expect(a.ok && b.ok).toBe(true);
    expect(deps.calls).toBe(1);
  });

  it('retries once on an unusable answer', async () => {
    const deps = fakeDeps([{ english: 'x', translation: 'not arabic' }, good]);
    const res = await performSummary({ ...input, url: 'https://example.com/b' }, deps);
    expect(res.ok).toBe(true);
    expect(deps.calls).toBe(2);
  });

  it('reports an empty page without calling the model', async () => {
    const deps = fakeDeps([good]);
    const res = await performSummary({ ...input, url: 'https://example.com/c', text: '   ' }, deps);
    expect(res.ok).toBe(false);
    expect(deps.calls).toBe(0);
  });
});
