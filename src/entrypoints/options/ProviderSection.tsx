import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { CHATGPT_USAGE_URL } from '@/lib/auth/chatgpt-oauth';
import { sendMessage } from '@/lib/messaging';
import { PROVIDERS, providerInfo } from '@/lib/llm/providers';
import type { ProviderId, Thinking } from '@/lib/llm/types';
import { clearChatGptTokens, getProviderKey, setActiveProvider, setProviderKey, setProviderSettings } from '@/lib/storage/settings';
import { ChatGptSignIn, LAST_ATTEMPT_KEY, type SignInAttempt } from './chatgpt-signin';
import { ModelPicker } from './ModelPicker';
import { statusLabel, useProviders, type ProviderView } from './useProviders';

type Note = { ok: boolean; text: string } | null;

const TONE: Record<ReturnType<typeof statusLabel>['tone'], string> = {
  active: 'bg-amber text-bg',
  ready: 'border border-amber/60 text-amber',
  pending: 'border border-border text-muted',
  off: 'text-faint',
};

/** Requests the provider's host permissions. Must be called before any await in a click handler. */
function requestAccess(provider: ProviderId, extra: chrome.permissions.Permissions = {}): Promise<boolean> {
  return browser.permissions.request({ origins: providerInfo(provider).origins, ...extra }).catch(() => false);
}

export function ProviderSection() {
  const { views, active } = useProviders();
  const [selected, setSelected] = useState<ProviderId | null>(null);
  const [switched, setSwitched] = useState<string | null>(null);
  const current = selected ?? active;

  // If the active provider is not set up but another is ready (say, you just signed in to ChatGPT),
  // make the ready one active instead of leaving lookups pointed at nothing.
  useEffect(() => {
    if (!views || views[active].ready) return;
    const ready = (selected && views[selected].ready ? selected : null) ?? PROVIDERS.find((p) => views[p.id].ready)?.id;
    if (!ready) return;
    void setActiveProvider(ready).then(() => setSwitched(`Lookups now use ${providerInfo(ready).name}, because ${providerInfo(active).name} isn't set up.`));
  }, [views, active, selected]);

  if (!views) return <p className="text-[13px] text-muted">Loading…</p>;
  const view = views[current];

  return (
    <div className="space-y-4">
      {switched && (
        <p role="status" className="rounded-lg border border-amber/50 bg-amber-soft px-3 py-2 text-[13px]">
          {switched}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => {
          const status = statusLabel(views[p.id], p.id === active);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              aria-pressed={p.id === current}
              className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${p.id === current ? 'border-amber bg-amber-soft' : 'border-border bg-surface-2 hover:border-faint'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold">{p.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${TONE[status.tone]}`}>{status.text}</span>
              </span>
              <span className="text-[12px] leading-snug text-muted">{p.tagline}</span>
            </button>
          );
        })}
      </div>
      <ProviderPanel key={current} view={view} isActive={current === active} />
    </div>
  );
}

function ProviderPanel({ view, isActive }: { view: ProviderView; isActive: boolean }) {
  const info = providerInfo(view.id);
  const [note, setNote] = useState<Note>(null);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    setNote(null);
    const res = await sendMessage('testProvider', view.id).catch(() => ({ ok: false, message: 'Could not reach the Siyaq background service.' }));
    setNote({ ok: res.ok, text: res.message });
    setTesting(false);
  };

  const makeActive = async () => {
    const permitted = view.permitted || (await requestAccess(view.id));
    if (!permitted) {
      setNote({ ok: false, text: `Siyaq needs permission to reach ${info.name}.` });
      return;
    }
    await setActiveProvider(view.id);
    setNote({ ok: true, text: `Lookups now use ${info.name}.` });
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">{info.name}</h3>
          <p className="text-[12.5px] text-muted">{info.tagline}</p>
        </div>
        {isActive ? (
          <span className="rounded-full bg-amber px-3 py-1 text-[12px] font-semibold text-bg">Used for lookups</span>
        ) : (
          <button type="button" className="btn-primary" onClick={() => void makeActive()} disabled={!view.ready} title={view.ready ? '' : 'Finish setting up this provider first'}>
            Use for lookups
          </button>
        )}
      </div>

      {info.auth === 'key' ? <KeyForm view={view} onNote={setNote} /> : <ChatGptPanel view={view} onNote={setNote} />}

      <div className="space-y-2">
        <h4 className="label">Model</h4>
        <ModelPicker
          provider={view.id}
          value={view.settings.model}
          enabled={view.hasCredential && view.permitted && (view.id !== 'chatgpt' || !!view.planUsage)}
          onChange={(model) => void setProviderSettings(view.id, { model })}
        />
      </div>

      <div className="space-y-2">
        <h4 className="label">Thinking</h4>
        <ThinkingPicker value={view.settings.thinking} onChange={(thinking) => void setProviderSettings(view.id, { thinking })} />
        <p className="text-[12px] text-faint">More thinking can help with tricky selections, but answers come slower and cost more. Models without a thinking setting ignore it.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button type="button" className="btn" onClick={() => void test()} disabled={testing || !view.ready}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        {note && <p className={`text-[13px] ${note.ok ? 'text-amber' : 'text-danger'}`}>{note.text}</p>}
      </div>
    </div>
  );
}

function KeyForm({ view, onNote }: { view: ProviderView; onNote: (n: Note) => void }) {
  const info = providerInfo(view.id);
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    void getProviderKey(view.id).then((k) => setKey(k ?? ''));
  }, [view.id]);

  const save = async () => {
    const access = requestAccess(view.id);
    const trimmed = key.trim();
    if (trimmed && !(await access)) {
      onNote({ ok: false, text: `Siyaq needs permission to reach ${info.name} to use this key.` });
      return;
    }
    await setProviderKey(view.id, trimmed);
    onNote({ ok: true, text: trimmed ? 'Key saved. It stays in this browser profile only.' : 'Key removed.' });
  };

  return (
    <div className="space-y-2">
      <h4 className="label">API key</h4>
      <div className="flex gap-2">
        <input
          className="input font-mono"
          type={show ? 'text' : 'password'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={info.keyPlaceholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={`${info.name} API key`}
        />
        <button type="button" className="btn shrink-0" onClick={() => setShow((s) => !s)}>
          {show ? 'Hide' : 'Show'}
        </button>
        <button type="button" className="btn-primary shrink-0" onClick={() => void save()}>
          Save
        </button>
      </div>
      <p className="text-[12px] text-faint">
        {view.hasCredential ? 'A key is saved. ' : ''}
        {info.keyUrl && (
          <>
            Create a key at{' '}
            <a className="text-muted underline hover:text-text" href={info.keyUrl} target="_blank" rel="noopener noreferrer">
              {new URL(info.keyUrl).host}
            </a>
            .{' '}
          </>
        )}
        The key is only ever sent to {info.name}.
      </p>
    </div>
  );
}

/** The sign-in result, shown in the Account block itself so it cannot be missed. */
function Outcome({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p role="status" className={`rounded-lg border px-3 py-2 text-[13px] ${note.ok ? 'border-amber/50 bg-amber-soft text-text' : 'border-danger/60 bg-danger/10 text-text'}`}>
      {note.text}
    </p>
  );
}

function ChatGptPanel({ view, onNote }: { view: ProviderView; onNote: (n: Note) => void }) {
  const flow = useRef<ChatGptSignIn | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [welcome, setWelcome] = useState(false);
  const [outcome, setOutcome] = useState<Note>(null);

  // After a reload, still say how the last attempt ended if it failed.
  useEffect(() => {
    void browser.storage.local.get(LAST_ATTEMPT_KEY).then((r) => {
      const last = r[LAST_ATTEMPT_KEY] as SignInAttempt | undefined;
      if (last && !last.ok && !view.hasCredential) {
        setOutcome({ ok: false, text: `The last sign-in attempt (${new Date(last.at).toLocaleString()}) stopped at "${last.step}"${last.detail ? ` (${last.detail})` : ''}.` });
      }
    });
  }, [view.hasCredential]);

  const signIn = async () => {
    const access = requestAccess('chatgpt', { permissions: ['tabs'] });
    if (!(await access)) {
      setOutcome({ ok: false, text: 'Siyaq needs these permissions to sign in with ChatGPT.' });
      return;
    }
    flow.current = new ChatGptSignIn();
    setWaiting(true);
    setOutcome(null);
    onNote(null);
    const res = await flow.current.run();
    setWaiting(false);
    flow.current = null;
    if (!res.ok) {
      setOutcome({ ok: false, text: res.message });
      return;
    }
    if (res.planUsage) setWelcome(true);
    setOutcome(res.planUsage ? { ok: true, text: `Signed in${res.email ? ` as ${res.email}` : ''}.` } : { ok: false, text: 'Signed in, but ChatGPT plan usage was not allowed. Sign in again and allow it to use your plan.' });
  };

  const signOut = async () => {
    await clearChatGptTokens();
    setOutcome({ ok: true, text: 'Signed out of ChatGPT.' });
  };

  if (view.hasCredential && !waiting) {
    return (
      <div className="space-y-3">
        <h4 className="label">Account</h4>
        {welcome && (
          <div className="rounded-xl border border-amber/50 bg-amber-soft p-3 text-[13px]">
            <p className="font-semibold">You're using your ChatGPT plan</p>
            <p className="mt-1 text-muted">Siyaq's lookups now count toward your ChatGPT plan's usage instead of an API key. You can see and limit this in ChatGPT settings.</p>
            <button type="button" className="mt-2 text-[12px] font-semibold text-amber" onClick={() => setWelcome(false)}>
              Got it
            </button>
          </div>
        )}
        <Outcome note={outcome} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px]">
            Signed in{view.email ? ' as ' : ''}
            {view.email && <span className="font-semibold">{view.email}</span>}
            <span className="ml-2 text-muted">· {view.planUsage ? 'Using ChatGPT plan' : 'Plan usage not allowed'}</span>
          </p>
          <span className="flex gap-2">
            <a className="btn no-underline" href={CHATGPT_USAGE_URL} target="_blank" rel="noopener noreferrer">
              Manage usage
            </a>
            {!view.planUsage && (
              <button type="button" className="btn" onClick={() => void signIn()}>
                Sign in again
              </button>
            )}
            <button type="button" className="btn" onClick={() => void signOut()}>
              Sign out
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="label">Account</h4>
      <p className="text-[13px] text-muted">
        Lookups use your ChatGPT plan's usage instead of an API key, at no extra cost from Siyaq. You can set a limit for Siyaq in ChatGPT settings. Signing in also asks Chrome to let Siyaq read the sign-in tab's address, which is how it receives the result.
      </p>
      {waiting ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
          <p className="text-[13px]">Finish signing in in the tab that just opened. This page updates by itself.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!flow.current?.submitAddress(pasted)) setOutcome({ ok: false, text: "That doesn't look like the sign-in result address. It starts with http://127.0.0.1." });
              setPasted('');
            }}
          >
            <input className="input text-[12.5px]" placeholder="If nothing happens, paste the address of the tab that shows an error" value={pasted} onChange={(e) => setPasted(e.target.value)} spellCheck={false} />
            <button type="submit" className="btn shrink-0" disabled={!pasted.trim()}>
              Continue
            </button>
          </form>
          <button type="button" className="text-[12px] text-muted hover:text-text" onClick={() => flow.current?.cancel()}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => void signIn()} className="inline-flex items-center gap-2 rounded-lg bg-text px-4 py-2 text-[14px] font-semibold text-bg hover:opacity-90">
          Continue with ChatGPT
        </button>
      )}
      <Outcome note={outcome} />
    </div>
  );
}

function ThinkingPicker({ value, onChange }: { value: Thinking; onChange: (t: Thinking) => void }) {
  const options: Thinking[] = ['low', 'medium', 'high'];
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-[13px]" role="radiogroup" aria-label="Thinking">
      {options.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={`rounded-md px-4 py-1 capitalize ${value === t ? 'bg-amber-soft font-semibold text-amber' : 'text-muted hover:text-text'}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
