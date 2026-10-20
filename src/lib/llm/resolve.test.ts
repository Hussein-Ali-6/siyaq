import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createChatGptTokenSource, resolveActiveClient, resolveClient } from '@/lib/llm/resolve';
import { getChatGptAuth, setActiveProvider, setChatGptAuth, setProviderKey, setProviderSettings } from '@/lib/storage/settings';

beforeEach(() => fakeBrowser.reset());

const signedIn = (expiresAt: number) => ({
  clientId: 'client_1', hostId: 'urn:uuid:h', port: 51234,
  accessToken: 'at-old', refreshToken: 'rt-old', expiresAt,
  scopes: ['openid', 'offline_access', 'chatgpt.tokens.use.direct'], email: 'a@b.c',
});

const tokenReply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('ChatGPT token source', () => {
  it('returns the stored token while it is fresh', async () => {
    await setChatGptAuth(signedIn(Date.now() + 30 * 60_000));
    let calls = 0;
    const source = createChatGptTokenSource(async () => { calls++; return tokenReply({}); });
    expect(await source()).toBe('at-old');
    expect(calls).toBe(0);
  });

  it('refreshes once near expiry, even for concurrent requests, and stores the rotated tokens', async () => {
    await setChatGptAuth(signedIn(Date.now() + 30_000));
    const bodies: string[] = [];
    const source = createChatGptTokenSource(async (_url, init) => {
      bodies.push(String(init?.body));
      return tokenReply({ access_token: 'at-new', refresh_token: 'rt-new', expires_in: 3600 });
    });
    const [a, b] = await Promise.all([source(), source()]);
    expect([a, b]).toEqual(['at-new', 'at-new']);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain('grant_type=refresh_token');
    expect(bodies[0]).toContain('refresh_token=rt-old');
    const stored = await getChatGptAuth();
    expect(stored).toMatchObject({ accessToken: 'at-new', refreshToken: 'rt-new', clientId: 'client_1', email: 'a@b.c' });
  });

  it('signs out when the refresh token is no longer usable', async () => {
    await setChatGptAuth(signedIn(Date.now() + 30_000));
    const source = createChatGptTokenSource(async () => tokenReply({ error: 'invalid_grant' }, 400));
    await expect(source()).rejects.toMatchObject({ code: 'signed_out' });
    expect(await getChatGptAuth()).toEqual({ clientId: 'client_1', hostId: 'urn:uuid:h', port: 51234, email: 'a@b.c' });
  });

  it('keeps the sign-in after a temporary failure', async () => {
    await setChatGptAuth(signedIn(Date.now() + 30_000));
    const source = createChatGptTokenSource(async () => tokenReply({ error: 'server_error' }, 503));
    await expect(source()).rejects.toMatchObject({ code: 'network' });
    expect((await getChatGptAuth())?.refreshToken).toBe('rt-old');
  });
});

describe('resolveClient', () => {
  it('asks for a key when the provider has none', async () => {
    const r = await resolveClient('openai');
    expect('error' in r && r.error.code).toBe('no_key');
  });

  it('asks for a model when none is chosen yet', async () => {
    await setProviderKey('openai', 'sk-test');
    const r = await resolveClient('openai');
    expect('error' in r && r.error.message).toMatch(/model/i);
  });

  it('builds a client with a provider-qualified model id', async () => {
    await setProviderKey('openai', 'sk-test');
    await setProviderSettings('openai', { model: 'gpt-6.1-mini' });
    const r = await resolveClient('openai');
    expect('client' in r && r.modelId).toBe('openai:gpt-6.1-mini');
  });

  it('asks to sign in to ChatGPT, and to allow plan usage when it was not granted', async () => {
    let r = await resolveClient('chatgpt');
    expect('error' in r && r.error.code).toBe('signed_out');
    await setChatGptAuth({ ...signedIn(Date.now() + 3_600_000), scopes: ['openid'] });
    await setProviderSettings('chatgpt', { model: 'gpt-6.1-sol' });
    r = await resolveClient('chatgpt');
    expect('error' in r && r.error.code).toBe('not_eligible');
  });
});

describe('resolveActiveClient', () => {
  it('uses a ready provider when the active one is not set up, as in a fresh profile signed in to ChatGPT', async () => {
    await setChatGptAuth(signedIn(Date.now() + 3_600_000));
    await setProviderSettings('chatgpt', { model: 'gpt-6.1-sol' });
    const r = await resolveActiveClient();
    expect('client' in r && r.provider).toBe('chatgpt');
  });

  it('keeps the active provider when it is ready', async () => {
    await setProviderKey('anthropic', 'sk-ant-test');
    await setChatGptAuth(signedIn(Date.now() + 3_600_000));
    await setProviderSettings('chatgpt', { model: 'gpt-6.1-sol' });
    await setActiveProvider('anthropic');
    const r = await resolveActiveClient();
    expect('client' in r && r.provider).toBe('anthropic');
  });

  it("reports the active provider's problem when no provider is ready", async () => {
    const r = await resolveActiveClient();
    expect('error' in r && r.error.message).toMatch(/Anthropic/);
  });
});
