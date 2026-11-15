import { describe, expect, it } from 'vitest';
import type { KeyTestResult, ModelListResult } from '@/lib/messaging';
import { connectWithKey, ensureModel, type ConnectDeps } from './connect';

interface Fake extends ConnectDeps {
  key: string | null;
  model: string;
  calls: string[];
}

function fake(over: { key?: string | null; model?: string; list?: ModelListResult; test?: KeyTestResult } = {}): Fake {
  const list: ModelListResult = over.list ?? { ok: true, models: [{ id: 'small', label: 'Small' }, { id: 'best', label: 'Best' }], recommended: 'best' };
  const test: KeyTestResult = over.test ?? { ok: true, message: 'It works.' };
  const state: Fake = {
    key: over.key ?? null,
    model: over.model ?? '',
    calls: [],
    getKey: async () => state.key,
    setKey: async (_provider, key) => {
      state.calls.push(`setKey:${key}`);
      state.key = key || null;
    },
    getModel: async () => state.model,
    setModel: async (_provider, model) => {
      state.calls.push(`setModel:${model}`);
      state.model = model;
    },
    listModels: async () => {
      state.calls.push('listModels');
      return list;
    },
    test: async () => {
      state.calls.push('test');
      return test;
    },
  };
  return state;
}

describe('ensureModel', () => {
  it('keeps a model that is already chosen, without loading the list', async () => {
    const deps = fake({ model: 'mine' });
    expect(await ensureModel(deps, 'openai')).toEqual({ ok: true, model: 'mine' });
    expect(deps.calls).toEqual([]);
  });

  it('chooses the recommended model when none is chosen', async () => {
    const deps = fake();
    expect(await ensureModel(deps, 'openai')).toEqual({ ok: true, model: 'best' });
    expect(deps.model).toBe('best');
  });

  it('chooses nothing when the list recommends nothing', async () => {
    const deps = fake({ list: { ok: true, models: [], recommended: null } });
    expect(await ensureModel(deps, 'openai')).toEqual({ ok: true, model: '' });
    expect(deps.calls).toEqual(['listModels']);
  });

  it('passes on a failure to load the list', async () => {
    const deps = fake({ list: { ok: false, message: 'No network.' } });
    expect(await ensureModel(deps, 'openai')).toEqual({ ok: false, message: 'No network.' });
  });
});

describe('connectWithKey', () => {
  it('saves the key, chooses the recommended model and tests, in that order', async () => {
    const deps = fake();
    expect(await connectWithKey(deps, 'openai', 'sk-new')).toEqual({ ok: true, model: 'best' });
    expect(deps.calls).toEqual(['setKey:sk-new', 'listModels', 'setModel:best', 'test']);
    expect(deps.key).toBe('sk-new');
  });

  it('does not load the list when a model is already chosen', async () => {
    const deps = fake({ model: 'claude-sonnet-5-5' });
    expect(await connectWithKey(deps, 'anthropic', 'sk-ant-new')).toEqual({ ok: true, model: 'claude-sonnet-5-5' });
    expect(deps.calls).toEqual(['setKey:sk-ant-new', 'test']);
  });

  it('connects without a test when there is no model to test with', async () => {
    const deps = fake({ list: { ok: true, models: [], recommended: null } });
    expect(await connectWithKey(deps, 'openrouter', 'sk-or-new')).toEqual({ ok: true, model: '' });
    expect(deps.calls).toEqual(['setKey:sk-or-new', 'listModels']);
  });

  it('removes a key the provider rejects when no key was saved before', async () => {
    const deps = fake({ model: 'm', test: { ok: false, message: 'The API key was rejected.', keyRejected: true } });
    expect(await connectWithKey(deps, 'anthropic', 'sk-bad')).toEqual({ ok: false, keySaved: false, message: 'The API key was rejected.' });
    expect(deps.key).toBeNull();
  });

  it('puts the earlier key back when the provider rejects the new one', async () => {
    const deps = fake({ key: 'sk-old', model: 'm', test: { ok: false, message: 'The API key was rejected.', keyRejected: true } });
    const result = await connectWithKey(deps, 'anthropic', 'sk-bad');
    expect(result).toEqual({ ok: false, keySaved: false, message: 'The API key was rejected.' });
    expect(deps.key).toBe('sk-old');
  });

  it('also puts the earlier key back when the rejection comes from the model list', async () => {
    const deps = fake({ key: 'sk-old', list: { ok: false, message: 'OpenAI rejected the key.', keyRejected: true } });
    expect(await connectWithKey(deps, 'openai', 'sk-bad')).toEqual({ ok: false, keySaved: false, message: 'OpenAI rejected the key.' });
    expect(deps.key).toBe('sk-old');
    expect(deps.calls).not.toContain('test');
  });

  it('keeps the new key when the test fails for another reason, such as no network', async () => {
    const deps = fake({ model: 'm', test: { ok: false, message: 'Could not reach OpenAI. Check your connection.' } });
    expect(await connectWithKey(deps, 'openai', 'sk-new')).toEqual({ ok: false, keySaved: true, message: 'Could not reach OpenAI. Check your connection.' });
    expect(deps.key).toBe('sk-new');
  });
});
