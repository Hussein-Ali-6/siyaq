import type { KeyTestResult, ModelListResult } from '@/lib/messaging';
import type { ProviderId } from '@/lib/llm/types';

/** The storage and messaging the connect steps use, passed in so they can be tested without a browser. */
export interface ConnectDeps {
  getKey(provider: ProviderId): Promise<string | null>;
  /** An empty key removes the stored one. */
  setKey(provider: ProviderId, key: string): Promise<void>;
  getModel(provider: ProviderId): Promise<string>;
  setModel(provider: ProviderId, model: string): Promise<void>;
  listModels(provider: ProviderId): Promise<ModelListResult>;
  test(provider: ProviderId): Promise<KeyTestResult>;
}

interface Failure {
  ok: false;
  message: string;
  keyRejected?: boolean;
}

/**
 * Makes sure a model is chosen: the stored one, or the recommended one from the provider's list.
 * `model` is empty when the list recommends nothing, and the reader then has to choose.
 */
export async function ensureModel(deps: ConnectDeps, provider: ProviderId): Promise<{ ok: true; model: string } | Failure> {
  const chosen = await deps.getModel(provider);
  if (chosen) return { ok: true, model: chosen };
  const list = await deps.listModels(provider);
  if (!list.ok) return list;
  if (!list.recommended) return { ok: true, model: '' };
  await deps.setModel(provider, list.recommended);
  return { ok: true, model: list.recommended };
}

export type ConnectResult =
  /** Connected. `model` is empty when the reader still has to choose one, and then nothing was tested. */
  | { ok: true; model: string }
  /** `keySaved` is false when the provider rejected the key and the earlier key, if any, was put back. */
  | { ok: false; keySaved: boolean; message: string };

/** Saves a key, chooses a model when none is chosen, and tests the connection. */
export async function connectWithKey(deps: ConnectDeps, provider: ProviderId, key: string): Promise<ConnectResult> {
  const before = await deps.getKey(provider);
  await deps.setKey(provider, key);

  const fail = async (failure: Pick<Failure, 'message' | 'keyRejected'>): Promise<ConnectResult> => {
    if (!failure.keyRejected) return { ok: false, keySaved: true, message: failure.message };
    await deps.setKey(provider, before ?? '');
    return { ok: false, keySaved: false, message: failure.message };
  };

  const chosen = await ensureModel(deps, provider);
  if (!chosen.ok) return fail(chosen);
  if (!chosen.model) return { ok: true, model: '' };
  const tested = await deps.test(provider);
  if (!tested.ok) return fail(tested);
  return { ok: true, model: chosen.model };
}
