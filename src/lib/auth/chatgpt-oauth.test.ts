import { describe, expect, it } from 'vitest';
import {
  CHATGPT_SCOPES,
  buildAuthorizeUrl,
  hasPlanUsage,
  isTerminalRefreshError,
  needsRefresh,
  parseCallbackUrl,
  parseTokenResponse,
  pkceChallenge,
  postToken,
  redirectUriFor,
  refreshRequestBody,
  tokenRequestBody,
} from '@/lib/auth/chatgpt-oauth';

const b64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const idToken = (claims: object) => `${b64url({ alg: 'RS256' })}.${b64url(claims)}.signature`;

describe('pkceChallenge', () => {
  it('matches the RFC 7636 example', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('buildAuthorizeUrl', () => {
  const base = { redirectUri: redirectUriFor(51234), state: 's1', nonce: 'n1', challenge: 'c1', hostId: 'urn:uuid:abc', appName: 'Siyaq' };

  it('registers a new client on first sign-in', () => {
    const url = new URL(buildAuthorizeUrl(base));
    expect(url.origin + url.pathname).toBe('https://auth.openai.com/api/accounts/authorize');
    const p = Object.fromEntries(url.searchParams);
    expect(p).toMatchObject({
      response_type: 'code',
      client_id: 'dynamic_agent_client',
      redirect_uri: 'http://127.0.0.1:51234/auth/callback',
      scope: CHATGPT_SCOPES,
      resource: 'https://api.openai.com/v1',
      state: 's1',
      nonce: 'n1',
      code_challenge: 'c1',
      code_challenge_method: 'S256',
      ext_agent_host_id: 'urn:uuid:abc',
      agent_name_hint: 'Siyaq',
    });
    expect(CHATGPT_SCOPES).toContain('chatgpt.tokens.use.direct');
  });

  it('reuses the issued client and offers the account on later sign-ins', () => {
    const p = new URL(buildAuthorizeUrl({ ...base, clientId: 'client_123', loginHint: 'a@b.c' })).searchParams;
    expect(p.get('client_id')).toBe('client_123');
    expect(p.get('agent_name_hint')).toBeNull();
    expect(p.get('login_hint')).toBe('a@b.c');
  });
});

describe('parseCallbackUrl', () => {
  const redirectUri = redirectUriFor(51234);

  it('returns the code and issued client id', () => {
    const r = parseCallbackUrl(`${redirectUri}?code=abc&state=s1&client_id=client_9`, { redirectUri, state: 's1' });
    expect(r).toEqual({ ok: true, code: 'abc', clientId: 'client_9' });
  });

  it('falls back to the saved client id on later sign-ins', () => {
    expect(parseCallbackUrl(`${redirectUri}?code=abc&state=s1`, { redirectUri, state: 's1', savedClientId: 'client_1' })).toEqual({ ok: true, code: 'abc', clientId: 'client_1' });
  });

  it('ignores addresses that are not the callback', () => {
    expect(parseCallbackUrl('https://auth.openai.com/log-in', { redirectUri, state: 's1' })).toBeNull();
    expect(parseCallbackUrl('http://127.0.0.1:9999/auth/callback?code=x&state=s1', { redirectUri, state: 's1' })).toBeNull();
  });

  it('rejects a wrong state, a denial, a missing code or a missing client id', () => {
    expect(parseCallbackUrl(`${redirectUri}?code=abc&state=other&client_id=c`, { redirectUri, state: 's1' })).toMatchObject({ ok: false });
    expect(parseCallbackUrl(`${redirectUri}?error=access_denied&state=s1`, { redirectUri, state: 's1' })).toMatchObject({ ok: false, error: 'access_denied' });
    expect(parseCallbackUrl(`${redirectUri}?state=s1&client_id=c`, { redirectUri, state: 's1' })).toMatchObject({ ok: false });
    expect(parseCallbackUrl(`${redirectUri}?code=abc&state=s1`, { redirectUri, state: 's1' })).toMatchObject({ ok: false });
    expect(parseCallbackUrl(`${redirectUri}?code=abc&state=s1&client_id=dynamic_agent_client`, { redirectUri, state: 's1' })).toMatchObject({ ok: false });
  });
});

describe('token requests', () => {
  it('exchanges a code with PKCE and the API resource', () => {
    const body = tokenRequestBody({ code: 'abc', verifier: 'v', redirectUri: redirectUriFor(1), clientId: 'client_9' });
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'client_9',
      code: 'abc',
      code_verifier: 'v',
      redirect_uri: 'http://127.0.0.1:1/auth/callback',
      resource: 'https://api.openai.com/v1',
    });
  });

  it('refreshes with the issued client id and no scope', () => {
    expect(Object.fromEntries(refreshRequestBody({ refreshToken: 'r', clientId: 'client_9' }))).toEqual({
      grant_type: 'refresh_token',
      client_id: 'client_9',
      refresh_token: 'r',
      resource: 'https://api.openai.com/v1',
    });
  });
});

describe('parseTokenResponse', () => {
  const now = 1_000_000;

  it('reads tokens, expiry, scopes and the account email', () => {
    const t = parseTokenResponse({
      access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: CHATGPT_SCOPES,
      id_token: idToken({ email: 'reader@example.com', nonce: 'n1' }),
    }, now, { nonce: 'n1' });
    expect(t).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresAt: now + 3_600_000, scopes: CHATGPT_SCOPES.split(' '), email: 'reader@example.com' });
  });

  it('rejects a nonce mismatch or missing access token', () => {
    expect(() => parseTokenResponse({ access_token: 'at', expires_in: 3600, scope: 'openid', id_token: idToken({ nonce: 'bad' }) }, now, { nonce: 'n1' })).toThrow();
    expect(() => parseTokenResponse({ expires_in: 3600, scope: 'openid' }, now, {})).toThrow();
  });

  it('keeps the previous scopes, refresh token and email when a refresh omits them', () => {
    const previous = { accessToken: 'old', refreshToken: 'r0', expiresAt: 0, scopes: ['openid', 'chatgpt.tokens.use.direct'], email: 'a@b.c' };
    const t = parseTokenResponse({ access_token: 'new', expires_in: 3600 }, now, { previous });
    expect(t).toEqual({ accessToken: 'new', refreshToken: 'r0', expiresAt: now + 3_600_000, scopes: previous.scopes, email: 'a@b.c' });
  });
});

describe('helpers', () => {
  it('checks the plan-usage scope', () => {
    expect(hasPlanUsage(['openid', 'chatgpt.tokens.use.direct'])).toBe(true);
    expect(hasPlanUsage(['openid'])).toBe(false);
  });

  it('refreshes two minutes before expiry', () => {
    expect(needsRefresh({ expiresAt: 1_000_000 }, 1_000_000 - 200_000)).toBe(false);
    expect(needsRefresh({ expiresAt: 1_000_000 }, 1_000_000 - 60_000)).toBe(true);
  });

  it('knows which refresh errors mean signing in again', () => {
    for (const code of ['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused']) {
      expect(isTerminalRefreshError(code)).toBe(true);
    }
    expect(isTerminalRefreshError('server_error')).toBe(false);
  });
});

describe('postToken', () => {
  it('reports the OAuth error code and HTTP status', async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as unknown as typeof fetch;
    await expect(postToken(new URLSearchParams(), fetchFn)).rejects.toMatchObject({ oauthCode: 'invalid_grant', status: 400 });
  });

  it('names an unreachable server instead of a bare "Failed to fetch"', async () => {
    const fetchFn = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const err = (await postToken(new URLSearchParams(), fetchFn).catch((e: unknown) => e)) as Error;
    expect(err).toMatchObject({ oauthCode: 'network' });
    expect(err.message).toMatch(/could not reach openai/i);
  });
});
