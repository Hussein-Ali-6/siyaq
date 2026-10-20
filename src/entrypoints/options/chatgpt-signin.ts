import { browser } from 'wxt/browser';
import {
  buildAuthorizeUrl,
  hasPlanUsage,
  parseCallbackUrl,
  parseTokenResponse,
  pkceChallenge,
  postToken,
  randomPort,
  randomToken,
  redirectUriFor,
  tokenRequestBody,
  type CallbackResult,
} from '@/lib/auth/chatgpt-oauth';
import { log } from '@/lib/log';
import { getChatGptAuth, setChatGptAuth } from '@/lib/storage/settings';

/** The last attempt's outcome, kept so it is still visible after a reload. Never holds a code or token. */
export interface SignInAttempt {
  at: number;
  ok: boolean;
  step: string;
  detail?: string;
}
export const LAST_ATTEMPT_KEY = 'chatgptLastAttempt';

async function record(attempt: Omit<SignInAttempt, 'at'>): Promise<void> {
  log.info('chatgpt_signin', { code: `${attempt.step}${attempt.detail ? `:${attempt.detail}` : ''}` });
  await browser.storage.local.set({ [LAST_ATTEMPT_KEY]: { ...attempt, at: Date.now() } });
}

export type SignInResult = { ok: true; email?: string; planUsage: boolean } | { ok: false; message: string };

const SIGN_IN_TIMEOUT_MS = 10 * 60_000;

const MESSAGES: Record<string, string> = {
  access_denied: 'Sign-in was cancelled.',
  closed: 'The sign-in tab was closed before sign-in finished.',
  timeout: 'Sign-in took too long. Try again.',
  cancelled: 'Sign-in was cancelled.',
  state_mismatch: "That sign-in didn't come from this request. Try again.",
  missing_code: 'ChatGPT did not return a sign-in code. Try again.',
  missing_client_id: 'ChatGPT did not register Siyaq. Try again.',
};

/**
 * Sign in with ChatGPT from the settings page. OpenAI only redirects to a loopback address
 * (http://127.0.0.1:PORT/auth/callback) and an extension cannot listen there, so the flow opens the
 * sign-in in a tab and reads the redirect address from that tab (this is why it needs the tabs
 * permission). Nothing has to answer on 127.0.0.1: the tab shows an error page, which is closed.
 */
export class ChatGptSignIn {
  private settle?: (r: CallbackResult) => void;
  private expected?: { redirectUri: string; state: string; savedClientId?: string };

  /** Completes the sign-in from an address the reader pasted, if the tab could not be read. */
  submitAddress(address: string): boolean {
    if (!this.expected || !this.settle) return false;
    const r = parseCallbackUrl(address.trim(), this.expected);
    if (!r) return false;
    this.settle(r);
    return true;
  }

  cancel(): void {
    this.settle?.({ ok: false, error: 'cancelled' });
  }

  async run(): Promise<SignInResult> {
    let auth = await getChatGptAuth();
    if (!auth) {
      auth = { hostId: `urn:uuid:${crypto.randomUUID()}`, port: randomPort() };
      await setChatGptAuth(auth);
    }
    const verifier = randomToken(48);
    const state = randomToken(16);
    const nonce = randomToken(16);
    const redirectUri = redirectUriFor(auth.port);
    this.expected = { redirectUri, state, savedClientId: auth.clientId };
    const url = buildAuthorizeUrl({
      redirectUri,
      state,
      nonce,
      challenge: await pkceChallenge(verifier),
      hostId: auth.hostId,
      appName: 'Siyaq',
      clientId: auth.clientId,
      loginHint: auth.email,
    });

    const settingsTab = await browser.tabs.getCurrent();
    const tab = await browser.tabs.create({ url, active: true });
    await record({ ok: true, step: 'tab_opened' });
    const cleanups: Array<() => void> = [];
    const result = await new Promise<CallbackResult>((resolve) => {
      let done = false;
      this.settle = (r) => {
        if (done) return;
        done = true;
        resolve(r);
      };
      const onUpdated = (tabId: number, change: { url?: string }, t: { url?: string; pendingUrl?: string }) => {
        if (tabId !== tab.id || !this.expected) return;
        for (const address of [change.url, t.pendingUrl, t.url]) {
          const r = address ? parseCallbackUrl(address, this.expected) : null;
          if (r) return this.settle?.(r);
        }
      };
      const onRemoved = (tabId: number) => {
        if (tabId === tab.id) this.settle?.({ ok: false, error: 'closed' });
      };
      browser.tabs.onUpdated.addListener(onUpdated);
      browser.tabs.onRemoved.addListener(onRemoved);
      const timer = setTimeout(() => this.settle?.({ ok: false, error: 'timeout' }), SIGN_IN_TIMEOUT_MS);
      cleanups.push(
        () => browser.tabs.onUpdated.removeListener(onUpdated),
        () => browser.tabs.onRemoved.removeListener(onRemoved),
        () => clearTimeout(timer),
      );
    });
    cleanups.forEach((c) => c());
    this.settle = undefined;
    if (tab.id !== undefined) await browser.tabs.remove(tab.id).catch(() => undefined);
    if (settingsTab?.id !== undefined) await browser.tabs.update(settingsTab.id, { active: true }).catch(() => undefined);

    if (!result.ok) {
      await record({ ok: false, step: 'callback', detail: result.error });
      return { ok: false, message: MESSAGES[result.error] ?? `Sign-in failed (${result.error}).` };
    }
    await record({ ok: true, step: 'callback_received' });

    // Keep the issued client before exchanging, so a later sign-in reuses this registration.
    auth = { ...auth, clientId: result.clientId };
    await setChatGptAuth(auth);
    let data: unknown;
    try {
      data = await postToken(tokenRequestBody({ code: result.code, verifier, redirectUri, clientId: result.clientId }));
    } catch (err) {
      const code = (err as { oauthCode?: string }).oauthCode ?? 'unknown';
      const status = (err as { status?: number }).status;
      await record({ ok: false, step: 'exchange', detail: status ? `${status} ${code}` : code });
      if (code === 'invalid_client') {
        // A rejected client means this registration is unusable; forget it so the next sign-in registers again.
        const { clientId: _dropped, ...rest } = auth;
        await setChatGptAuth(rest);
      }
      const message = err instanceof Error ? err.message : 'Sign-in failed.';
      return { ok: false, message: `Signing in reached OpenAI, but exchanging the sign-in code failed: ${message}` };
    }
    try {
      const tokens = parseTokenResponse(data, Date.now(), { nonce });
      await setChatGptAuth({ ...auth, ...tokens });
      const planUsage = hasPlanUsage(tokens.scopes);
      await record({ ok: true, step: 'signed_in', detail: planUsage ? 'plan_usage' : 'no_plan_usage' });
      return { ok: true, email: tokens.email, planUsage };
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      await record({ ok: false, step: 'token_response', detail: detail.slice(0, 80) });
      return { ok: false, message: `OpenAI returned tokens Siyaq could not use: ${detail}` };
    }
  }
}
