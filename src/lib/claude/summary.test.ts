import { describe, expect, it } from 'vitest';
import { performSummary, type SummaryDeps } from '@/lib/claude/summary';
import type { Summary } from '@/lib/types';

function fakeDeps(answers: unknown[], delayMs = 0): SummaryDeps & { calls: number; store: Map<string, Summary> } {
  const store = new Map<string, Summary>();
  const deps = {
    calls: 0,
    store,
    client: {
      async callStructured() {
        const next = answers[deps.calls++];
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        return { json: next, stopReason: 'end_turn' };
      },
      async ping() {},
    },
    cache: {
      get: async (url: string) => store.get(url) ?? null,
      set: async (url: string, s: Summary) => {
        store.set(url, s);
      },
    },
    retryDelayMs: 0,
  };
  return deps;
}

const input = { url: 'https://example.com/a', title: 'T', siteName: 'S', text: 'Article body text.' };
const good = { english: 'A short summary.', arabic: 'ملخص قصير.' };

describe('performSummary', () => {
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
    const deps = fakeDeps([{ english: 'x', arabic: 'not arabic' }, good]);
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
