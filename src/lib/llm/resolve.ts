import { browser } from 'wxt/browser';
import { isTerminalRefreshError, needsRefresh, parseTokenResponse, postToken, refreshRequestBody, hasPlanUsage, type ChatGptTokens } from '@/lib/auth/chatgpt-oauth';
import { createAiSdkClient } from '@/lib/llm/aisdk';
import { createAnthropicClient } from '@/lib/llm/anthropic';
import { createChatGptClient } from '@/lib/llm/chatgpt';
import { PROVIDER_IDS, providerInfo } from '@/lib/llm/providers';
import { LlmError, type LlmClient, type ProviderId } from '@/lib/llm/types';
import { clearChatGptTokens, getActiveProvider, getChatGptAuth, getProviderKey, getProviderSettings, setChatGptAuth } from '@/lib/storage/settings';
import type { UserError } from '@/lib/types';

export interface ResolvedClient {
  client: LlmClient;
  provider: ProviderId;
  model: string;
  /** "provider:model", used in cache keys and shown on the card. */
  modelId: string;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Returns a function that yields a valid ChatGPT access token, refreshing it near expiry. Concurrent
 * callers share one refresh, as OpenAI asks refreshes for a session to be serialized.
 */
export function createChatGptTokenSource(fetchFn: FetchFn = (i, init) => fetch(i, init)): () => Promise<string> {
  let refreshing: Promise<string> | null = null;

  async function refresh(): Promise<string> {
    const auth = await getChatGptAuth();
    if (!auth?.accessToken || auth.expiresAt === undefined) throw signedOut();
    if (!needsRefresh({ expiresAt: auth.expiresAt }, Date.now())) return auth.accessToken;
    if (!auth.refreshToken || !auth.clientId) {
      await clearChatGptTokens();
      throw signedOut();
    }
    let data: unknown;
    try {
      data = await postToken(refreshRequestBody({ refreshToken: auth.refreshToken, clientId: auth.clientId }), fetchFn as typeof fetch);
    } catch (err) {
      const code = (err as { oauthCode?: string }).oauthCode;
      if (code && isTerminalRefreshError(code)) {
        await clearChatGptTokens();
        throw signedOut();
      }
      throw new LlmError('network', 'Could not renew the ChatGPT sign-in. Try again in a moment.');
    }
    const tokens = parseTokenResponse(data, Date.now(), { previous: auth as ChatGptTokens });
    await setChatGptAuth({ ...auth, ...tokens });
    return tokens.accessToken;
  }

  return async () => {
    const auth = await getChatGptAuth();
    if (!auth?.accessToken || auth.expiresAt === undefined) throw signedOut();
    if (!needsRefresh({ expiresAt: auth.expiresAt }, Date.now())) return auth.accessToken;
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };
}

const signedOut = () => new LlmError('signed_out', 'Sign in with ChatGPT in Siyaq settings.');

export const chatGptAccessToken = createChatGptTokenSource();

/** Whether the extension may reach this provider's servers (optional permissions are granted per provider). */
export async function hasProviderPermission(provider: ProviderId): Promise<boolean> {
  try {
    return await browser.permissions.contains({ origins: providerInfo(provider).origins });
  } catch {
    return true;
  }
}

const cache = new Map<string, LlmClient>();

/** Builds (or reuses) the client for a provider from its saved credentials, model and thinking level. */
export async function resolveClient(provider: ProviderId): Promise<ResolvedClient | { error: UserError }> {
  const info = providerInfo(provider);
  const settings = await getProviderSettings(provider);
  let credential: string;

  if (info.auth === 'chatgpt') {
    const auth = await getChatGptAuth();
    if (!auth?.accessToken) return { error: { code: 'signed_out', message: 'Sign in with ChatGPT in Siyaq settings.' } };
    if (!hasPlanUsage(auth.scopes)) {
      return { error: { code: 'not_eligible', message: 'ChatGPT plan usage was not allowed when you signed in. Sign in again in Siyaq settings and allow it.' } };
    }
    credential = auth.clientId ?? 'chatgpt';
  } else {
    const key = await getProviderKey(provider);
    if (!key) return { error: { code: 'no_key', message: `Add your ${info.name} API key in Siyaq settings.` } };
    credential = key;
  }
  if (!settings.model) return { error: { code: 'no_key', message: `Choose a ${info.name} model in Siyaq settings.` } };
  if (!(await hasProviderPermission(provider))) {
    return { error: { code: 'no_key', message: `Siyaq needs permission to reach ${info.name}. Open settings and save the provider again.` } };
  }

  const cacheKey = [provider, settings.model, settings.thinking, credential].join('\u0001');
  let client = cache.get(cacheKey);
  if (!client) {
    const opts = { model: settings.model, thinking: settings.thinking };
    if (provider === 'anthropic') client = createAnthropicClient(credential, opts);
    else if (provider === 'chatgpt') client = createChatGptClient({ ...opts, getAccessToken: chatGptAccessToken });
    else client = createAiSdkClient(provider, { ...opts, apiKey: credential });
    cache.clear();
    cache.set(cacheKey, client);
  }
  return { client, provider, model: settings.model, modelId: `${provider}:${settings.model}` };
}

/**
 * The client for the active provider. If that provider is not set up but another one is ready (for
 * example a fresh profile where the reader only signed in to ChatGPT), lookups use the ready one
 * rather than failing; the card footer shows which provider answered.
 */
export async function resolveActiveClient(): Promise<ResolvedClient | { error: UserError; provider: ProviderId }> {
  const active = await getActiveProvider();
  const resolved = await resolveClient(active);
  if (!('error' in resolved)) return resolved;
  for (const provider of PROVIDER_IDS) {
    if (provider === active) continue;
    const alternative = await resolveClient(provider);
    if (!('error' in alternative)) return alternative;
  }
  return { error: resolved.error, provider: active };
}
