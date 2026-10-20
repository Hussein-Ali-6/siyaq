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
import { getChatGptAuth, setChatGptAuth } from '@/lib/storage/settings';

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
    const cleanups: Array<() => void> = [];
    const result = await new Promise<CallbackResult>((resolve) => {
      let done = false;
      this.settle = (r) => {
        if (done) return;
        done = true;
        resolve(r);
      };
      const onUpdated = (tabId: number, change: { url?: string }, t: { url?: string }) => {
        if (tabId !== tab.id || !this.expected) return;
        const address = change.url ?? t.url;
        const r = address ? parseCallbackUrl(address, this.expected) : null;
        if (r) this.settle?.(r);
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

    if (!result.ok) return { ok: false, message: MESSAGES[result.error] ?? `Sign-in failed (${result.error}).` };

    // Keep the issued client before exchanging, so a later sign-in reuses this registration.
    auth = { ...auth, clientId: result.clientId };
    await setChatGptAuth(auth);
    try {
      const data = await postToken(tokenRequestBody({ code: result.code, verifier, redirectUri, clientId: result.clientId }));
      const tokens = parseTokenResponse(data, Date.now(), { nonce });
      await setChatGptAuth({ ...auth, ...tokens });
      return { ok: true, email: tokens.email, planUsage: hasPlanUsage(tokens.scopes) };
    } catch (err) {
      // A rejected client means this registration is unusable; forget it so the next sign-in registers again.
      if ((err as { oauthCode?: string }).oauthCode === 'invalid_client') {
        const { clientId: _dropped, ...rest } = auth;
        await setChatGptAuth(rest);
      }
      return { ok: false, message: err instanceof Error ? err.message : 'Sign-in failed.' };
    }
  }
}
