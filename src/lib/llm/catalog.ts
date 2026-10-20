import Anthropic from '@anthropic-ai/sdk';
import { normalizeModels, recommendModel, type ModelOption } from '@/lib/llm/models';
import { providerInfo } from '@/lib/llm/providers';
import { chatGptAccessToken } from '@/lib/llm/resolve';
import { toLlmError } from '@/lib/llm/anthropic';
import { LlmError, type ProviderId } from '@/lib/llm/types';
import { getProviderKey } from '@/lib/storage/settings';

export interface ModelCatalog {
  models: ModelOption[];
  recommended: string | null;
}

async function getJson(url: string, headers: Record<string, string>, providerName: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json', ...headers }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new LlmError('network', `Could not reach ${providerName}. Check your connection.`);
  }
  if (res.status === 401 || res.status === 403) throw new LlmError('bad_key', `${providerName} rejected the key.`, res.status);
  if (!res.ok) throw new LlmError('unknown', `${providerName} could not list its models (${res.status}).`, res.status);
  return res.json();
}

/** Lists the models this account can use, live from the provider, with a recommended default. */
export async function listModels(provider: ProviderId): Promise<ModelCatalog> {
  const name = providerInfo(provider).name;
  let raw: unknown;
  if (provider === 'chatgpt') {
    raw = await getJson('https://api.openai.com/v1/models', { authorization: `Bearer ${await chatGptAccessToken()}` }, 'ChatGPT');
  } else if (provider === 'openrouter') {
    raw = await getJson('https://openrouter.ai/api/v1/models', {}, name);
  } else {
    const key = await getProviderKey(provider);
    if (!key) throw new LlmError('no_key', `Add your ${name} API key first.`);
    if (provider === 'anthropic') {
      try {
        const page = await new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 }).models.list({ limit: 100 });
        raw = { data: page.data };
      } catch (err) {
        throw toLlmError(err);
      }
    } else if (provider === 'openai') {
      raw = await getJson('https://api.openai.com/v1/models', { authorization: `Bearer ${key}` }, name);
    } else {
      raw = await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { 'x-goog-api-key': key }, name);
    }
  }
  const models = normalizeModels(provider, raw);
  return { models, recommended: recommendModel(provider, models) };
}
