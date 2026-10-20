/**
 * Sign in with ChatGPT for open-source apps (OpenAI's documented "direct" flow): OAuth 2.0
 * authorization code with PKCE, a loopback redirect on 127.0.0.1, no client secret. The first sign-in
 * registers a client for this install; later sign-ins reuse it.
 * Docs: https://developers.openai.com/siwc/token-sharing-open-source
 */
export const CHATGPT_AUTHORIZE_URL = 'https://auth.openai.com/api/accounts/authorize';
export const CHATGPT_TOKEN_URL = 'https://auth.openai.com/api/accounts/oauth/token';
export const CHATGPT_RESOURCE = 'https://api.openai.com/v1';
export const CHATGPT_SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
export const PLAN_USAGE_SCOPE = 'chatgpt.tokens.use.direct';
export const CHATGPT_USAGE_URL = 'https://chatgpt.com/settings/usage';
const NEW_CLIENT = 'dynamic_agent_client';

export interface ChatGptTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  email?: string;
}

/** Everything persisted for ChatGPT: the install's registration plus the current tokens, if signed in. */
export interface ChatGptAuth extends Partial<ChatGptTokens> {
  clientId?: string;
  hostId: string;
  port: number;
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function redirectUriFor(port: number): string {
  return `http://127.0.0.1:${port}/auth/callback`;
}

/** A random high port chosen once per install; OpenAI requires the same redirect apart from the port. */
export function randomPort(): number {
  return 49152 + Math.floor(Math.random() * (65535 - 49152));
}

export function buildAuthorizeUrl(p: {
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
  hostId: string;
  appName: string;
  clientId?: string;
  loginHint?: string;
}): string {
  const url = new URL(CHATGPT_AUTHORIZE_URL);
  const q = url.searchParams;
  q.set('response_type', 'code');
  q.set('client_id', p.clientId ?? NEW_CLIENT);
  q.set('redirect_uri', p.redirectUri);
  q.set('scope', CHATGPT_SCOPES);
  q.set('resource', CHATGPT_RESOURCE);
  q.set('state', p.state);
  q.set('nonce', p.nonce);
  q.set('code_challenge', p.challenge);
  q.set('code_challenge_method', 'S256');
  q.set('ext_agent_host_id', p.hostId);
  if (!p.clientId) q.set('agent_name_hint', p.appName);
  if (p.loginHint) q.set('login_hint', p.loginHint);
  return url.toString();
}

export type CallbackResult = { ok: true; code: string; clientId: string } | { ok: false; error: string };

/**
 * Reads the loopback redirect. Returns null for any address that is not our callback, so it can be
 * called on every navigation of the sign-in tab.
 */
export function parseCallbackUrl(address: string, expected: { redirectUri: string; state: string; savedClientId?: string }): CallbackResult | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  const want = new URL(expected.redirectUri);
  if (url.origin !== want.origin || url.pathname !== want.pathname) return null;
  const q = url.searchParams;
  if (q.getAll('state').length !== 1 || q.get('state') !== expected.state) return { ok: false, error: 'state_mismatch' };
  const denied = q.get('error');
  if (denied) return { ok: false, error: denied };
  const code = q.get('code');
  if (!code || q.getAll('code').length !== 1) return { ok: false, error: 'missing_code' };
  const clientId = q.get('client_id') ?? expected.savedClientId;
  if (!clientId || clientId === NEW_CLIENT || !/^[A-Za-z0-9_-]{1,200}$/.test(clientId)) return { ok: false, error: 'missing_client_id' };
  return { ok: true, code, clientId };
}

export function tokenRequestBody(p: { code: string; verifier: string; redirectUri: string; clientId: string }): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: p.clientId,
    code: p.code,
    code_verifier: p.verifier,
    redirect_uri: p.redirectUri,
    resource: CHATGPT_RESOURCE,
  });
}

export function refreshRequestBody(p: { refreshToken: string; clientId: string }): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: p.clientId,
    refresh_token: p.refreshToken,
    resource: CHATGPT_RESOURCE,
  });
}

/** The ID token's claims, decoded but not verified: used only to show the account and check the nonce. */
function idTokenClaims(idToken: unknown): Record<string, unknown> {
  if (typeof idToken !== 'string') return {};
  const part = idToken.split('.')[1];
  if (!part) return {};
  try {
    const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims === 'object' && claims !== null ? (claims as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseTokenResponse(data: unknown, now: number, opts: { nonce?: string; previous?: ChatGptTokens }): ChatGptTokens {
  const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  if (typeof d.access_token !== 'string' || !d.access_token || typeof d.expires_in !== 'number' || d.expires_in <= 0) {
    throw new Error('ChatGPT returned incomplete credentials.');
  }
  const claims = idTokenClaims(d.id_token);
  if (opts.nonce !== undefined && d.id_token !== undefined && claims.nonce !== opts.nonce) {
    throw new Error('The ChatGPT sign-in could not be verified.');
  }
  const scopes = typeof d.scope === 'string' ? d.scope.split(/\s+/).filter(Boolean) : (opts.previous?.scopes ?? []);
  const refreshToken = typeof d.refresh_token === 'string' && d.refresh_token ? d.refresh_token : opts.previous?.refreshToken;
  const email = typeof claims.email === 'string' ? claims.email : opts.previous?.email;
  return {
    accessToken: d.access_token,
    ...(refreshToken ? { refreshToken } : {}),
    expiresAt: now + d.expires_in * 1000,
    scopes,
    ...(email ? { email } : {}),
  };
}

export const hasPlanUsage = (scopes: string[] | undefined) => !!scopes?.includes(PLAN_USAGE_SCOPE);

export const needsRefresh = (auth: { expiresAt: number }, now: number) => auth.expiresAt - now < 120_000;

const TERMINAL_REFRESH = new Set(['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused']);
export const isTerminalRefreshError = (code: string) => TERMINAL_REFRESH.has(code);

/** Posts a form to the token endpoint and returns the parsed JSON, or throws with the OAuth error code. */
export async function postToken(body: URLSearchParams, fetchFn: typeof fetch = fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(CHATGPT_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
      redirect: 'error',
    });
  } catch {
    throw Object.assign(new Error("Could not reach OpenAI's sign-in server. Check your connection and that Siyaq may access auth.openai.com."), { oauthCode: 'network' });
  }
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof data === 'object' && data !== null && typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : `http_${res.status}`;
    throw Object.assign(new Error(`ChatGPT sign-in failed (${code}).`), { oauthCode: code, status: res.status });
  }
  return data;
}
