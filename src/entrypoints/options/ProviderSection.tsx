import { useEffect, useId, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { CHATGPT_USAGE_URL } from '@/lib/auth/chatgpt-oauth';
import { sendMessage } from '@/lib/messaging';
import { PROVIDERS, providerInfo } from '@/lib/llm/providers';
import type { ProviderId, Thinking } from '@/lib/llm/types';
import { clearChatGptTokens, getProviderKey, getProviderSettings, setActiveProvider, setProviderKey, setProviderSettings } from '@/lib/storage/settings';
import { Collapsible } from '@/ui/components/Collapsible';
import { CheckIcon, ChevronIcon, ExternalIcon } from '@/ui/components/icons';
import { ChatGptSignIn, LAST_ATTEMPT_KEY, type SignInAttempt } from './chatgpt-signin';
import { connectWithKey, type ConnectDeps } from './connect';
import { NoteBox, Segmented, type Note } from './controls';
import { ModelPicker } from './ModelPicker';
import { useSaved } from './saved-message';
import { maskKey, rowStatus, type ProviderView, type ProviderViews, type RowStatus } from './status';

const UNREACHABLE = 'Could not reach the Siyaq background service.';

const connectDeps: ConnectDeps = {
  getKey: getProviderKey,
  setKey: setProviderKey,
  getModel: async (provider) => (await getProviderSettings(provider)).model,
  setModel: async (provider, model) => {
    await setProviderSettings(provider, { model });
  },
  listModels: (provider) => sendMessage('listModels', provider).catch(() => ({ ok: false as const, message: UNREACHABLE })),
  test: (provider) => sendMessage('testProvider', provider).catch(() => ({ ok: false, message: UNREACHABLE })),
};

const THINKING: ReadonlyArray<{ id: Thinking; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

/** Filled amber is kept for the provider in use, so it cannot be mistaken for the row that is open. */
const TONE: Record<RowStatus['tone'], string> = {
  active: 'rounded-full bg-amber px-2.5 py-0.5 font-semibold text-bg',
  ready: 'text-text',
  attention: 'rounded-full border border-danger/70 px-2.5 py-0.5 text-danger',
  off: 'text-muted',
};

/** Requests the provider's host permissions. Must be called before any await in a click handler. */
function requestAccess(provider: ProviderId, extra: chrome.permissions.Permissions = {}): Promise<boolean> {
  return browser.permissions.request({ origins: providerInfo(provider).origins, ...extra }).catch(() => false);
}

/**
 * Every provider as a row. A row shows its state and opens in place to connect or change it. `open`
 * is the row that is open, and `active` the provider that answers lookups.
 */
export function ProviderSection({
  views,
  active,
  open,
  onOpen,
  busy,
  onBusy,
}: {
  views: ProviderViews;
  active: ProviderId;
  open: ProviderId | null;
  onOpen: (provider: ProviderId | null) => void;
  /** A key is being connected. The page holds `views` as they were until that has ended. */
  busy: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [switched, setSwitched] = useState<string | null>(null);
  // The provider being connected on this visit. Its own row reports the switch, so no banner is shown for it.
  const connecting = useRef<ProviderId | null>(null);

  // If the provider in use is not set up but another is ready (say, you just signed in to ChatGPT),
  // lookups move to the ready one instead of staying pointed at nothing.
  useEffect(() => {
    if (views[active].ready) return;
    const ready = (open && views[open].ready ? open : null) ?? PROVIDERS.find((p) => views[p.id].ready)?.id;
    if (!ready) return;
    void setActiveProvider(ready).then(() => {
      if (connecting.current !== ready) setSwitched(`Lookups now use ${providerInfo(ready).name}, because ${providerInfo(active).name} is not set up.`);
    });
  }, [views, active, open]);

  return (
    <div className="space-y-3">
      {switched && <NoteBox note={{ ok: true, text: switched }} />}
      <ul className="space-y-2">
        {PROVIDERS.map((p) => (
          <ProviderRow
            key={p.id}
            view={views[p.id]}
            inUse={views[active]}
            busy={busy}
            onBusy={onBusy}
            open={p.id === open}
            onToggle={() => onOpen(p.id === open ? null : p.id)}
            onConnecting={() => {
              connecting.current = p.id;
            }}
          />
        ))}
      </ul>
    </div>
  );
}

interface RowProps {
  view: ProviderView;
  /** The provider that answers lookups, which may be this one. */
  inUse: ProviderView;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onConnecting: () => void;
}

function ProviderRow({ view, inUse, busy, onBusy, open, onToggle, onConnecting }: RowProps & { open: boolean; onToggle: () => void }) {
  const info = providerInfo(view.id);
  const status = rowStatus(view, view.id === inUse.id);
  const panelId = useId();
  return (
    <li className={`rounded-xl border ${open ? 'border-faint bg-surface-2/60' : 'border-border hover:border-faint'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={open ? panelId : undefined} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{info.name}</span>
          <span className={`block text-[13px] text-muted ${view.ready ? 'break-all font-mono' : ''}`}>{view.ready ? view.settings.model : info.tagline}</span>
        </span>
        <span className={`flex shrink-0 items-center gap-1 text-[12px] ${TONE[status.tone]}`}>
          {status.tone === 'ready' && <CheckIcon className="h-3.5 w-3.5 text-amber" />}
          {status.text}
        </span>
        <ChevronIcon open={open} className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div id={panelId} className="space-y-4 border-t border-border px-4 py-4">
          <RowBody view={view} inUse={inUse} busy={busy} onBusy={onBusy} onConnecting={onConnecting} />
        </div>
      )}
    </li>
  );
}

function RowBody({ view, inUse, busy, onBusy, onConnecting }: RowProps) {
  const info = providerInfo(view.id);
  const isInUse = view.id === inUse.id;
  const [note, setNote] = useState<Note>(null);
  // The key or sign-in is in place and the provider can be reached, so a model can be chosen.
  const usable = view.hasCredential && view.permitted && (view.id !== 'chatgpt' || !!view.planUsage);

  /** Returns true when the key ended up saved, so the form that asked for it can close. */
  const connect = async (key: string): Promise<boolean> => {
    // Before any await: Chrome only shows a permission request during the click itself.
    const access = requestAccess(view.id);
    const hadKey = view.hasCredential;
    const becomesInUse = isInUse || !inUse.ready;
    onConnecting();
    onBusy(true);
    setNote(null);
    if (!(await access)) {
      onBusy(false);
      setNote({ ok: false, text: `Siyaq needs permission to reach ${info.name} to use this key.` });
      return false;
    }
    const result = await connectWithKey(connectDeps, view.id, key);
    onBusy(false);
    if (!result.ok) {
      const kept = hadKey ? 'The key you had before is still saved.' : 'The key was not saved.';
      setNote({ ok: false, text: result.keySaved ? `The key is saved, but the test did not pass. ${result.message}` : `${result.message} ${kept}` });
      return result.keySaved;
    }
    if (!result.model) setNote({ ok: true, text: 'Connected. Choose a model to finish.' });
    else setNote({ ok: true, text: becomesInUse ? `Connected. Lookups now use ${info.name} with ${result.model}.` : `Connected with ${result.model}.` });
    return true;
  };

  const useForLookups = async () => {
    await setActiveProvider(view.id);
    setNote({ ok: true, text: `Lookups now use ${info.name}.` });
  };

  return (
    <>
      {info.auth === 'key' ? <KeyBlock view={view} busy={busy} onConnect={connect} onNote={setNote} /> : <ChatGptPanel view={view} onConnecting={onConnecting} />}

      {view.hasCredential && !view.permitted && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/60 bg-danger/10 px-3 py-2">
          <p className="text-[13px]">Siyaq needs permission to reach {info.name}.</p>
          <button type="button" className="btn-primary" onClick={() => void requestAccess(view.id)}>
            Allow access
          </button>
        </div>
      )}

      {usable && <ModelSetting view={view} />}

      {view.ready && !isInUse && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
          <p className="text-[13px] text-muted">Lookups use {providerInfo(inUse.id).name} now.</p>
          <button type="button" className="btn-primary" onClick={() => void useForLookups()}>
            Use {info.name} for lookups
          </button>
        </div>
      )}

      {usable && <Advanced view={view} onNote={setNote} />}
      <NoteBox note={note} />
    </>
  );
}

function KeyBlock({ view, busy, onConnect, onNote }: { view: ProviderView; busy: boolean; onConnect: (key: string) => Promise<boolean>; onNote: (note: Note) => void }) {
  const info = providerInfo(view.id);
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [masked, setMasked] = useState('');

  // Read again after a connect attempt, which may have replaced the key.
  useEffect(() => {
    void getProviderKey(view.id).then((k) => setMasked(k ? maskKey(k) : ''));
  }, [view.id, view.hasCredential, busy]);

  const remove = async () => {
    await setProviderKey(view.id, '');
    setConfirming(false);
    onNote({ ok: true, text: 'Key removed.' });
  };

  // While a connect attempt runs the form stays, even though the key is already stored.
  if (view.hasCredential && !replacing && !busy) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px]">
          <span className="text-muted">API key</span>
          <span className="ml-3 font-mono">{masked}</span>
        </p>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-[13px]">
            Remove this key from Siyaq?
            <button type="button" className="btn" onClick={() => void remove()}>
              Remove
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </span>
        ) : (
          <span className="flex gap-2">
            <button type="button" className="btn" onClick={() => setReplacing(true)}>
              Replace
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(true)}>
              Remove
            </button>
          </span>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const typed = key.trim();
        if (!typed || busy) return;
        void onConnect(typed).then((saved) => {
          if (!saved) return;
          setKey('');
          setShow(false);
          setReplacing(false);
        });
      }}
    >
      <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted">
        <li>
          Create an API key at{' '}
          {info.keyUrl && (
            <a className="inline-flex items-center gap-1 text-text underline hover:text-amber" href={info.keyUrl} target="_blank" rel="noopener noreferrer">
              {new URL(info.keyUrl).host}
              <ExternalIcon className="h-3 w-3" />
            </a>
          )}
          . Usage is billed by {info.name}, not by Siyaq.
        </li>
        <li>Paste it here and press Connect.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <input
          className="input min-w-[200px] flex-1 font-mono"
          type={show ? 'text' : 'password'}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={info.keyPlaceholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={`${info.name} API key`}
          data-key-input
        />
        <button type="button" className="btn shrink-0" onClick={() => setShow((s) => !s)}>
          {show ? 'Hide' : 'Show'}
        </button>
        <button type="submit" className="btn-primary shrink-0" disabled={!key.trim() || busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
        {replacing && !busy && (
          <button type="button" className="btn shrink-0" onClick={() => setReplacing(false)}>
            Cancel
          </button>
        )}
      </div>
      <p className="text-[12px] text-muted">The key stays in this browser profile and is only ever sent to {info.name}.</p>
    </form>
  );
}

/** The chosen model, and the list to choose another. The list is open while no model is chosen. */
function ModelSetting({ view }: { view: ProviderView }) {
  const saved = useSaved();
  const [wanted, setWanted] = useState(false);
  const model = view.settings.model;
  const picking = wanted || !model;

  const choose = (next: string, byReader: boolean) => {
    void setProviderSettings(view.id, { model: next }).then(() => {
      if (!byReader) return;
      setWanted(false);
      saved();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px]">
          <span className="text-muted">Model</span>
          <span className="ml-3 font-mono">{model || 'none chosen yet'}</span>
        </p>
        {model && (
          <button type="button" className="btn" aria-expanded={picking} onClick={() => setWanted((w) => !w)}>
            {wanted ? 'Close' : 'Change'}
          </button>
        )}
      </div>
      {picking && <ModelPicker provider={view.id} value={model} onChange={choose} />}
    </div>
  );
}

/** What few readers need: the thinking level and a connection test. */
function Advanced({ view, onNote }: { view: ProviderView; onNote: (note: Note) => void }) {
  const saved = useSaved();
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    onNote(null);
    const res = await connectDeps.test(view.id);
    onNote({ ok: res.ok, text: res.message });
    setTesting(false);
  };

  return (
    <Collapsible title="Advanced">
      <div className="space-y-4 pt-1">
        <div className="space-y-2">
          <p className="text-[13px] font-medium">Thinking</p>
          <Segmented label="Thinking" options={THINKING} value={view.settings.thinking} onChange={(thinking) => void setProviderSettings(view.id, { thinking }).then(saved)} />
          <p className="text-[12px] text-muted">More thinking can help with tricky selections, but answers come slower and cost more. Models without a thinking setting ignore it.</p>
        </div>
        <button type="button" className="btn" onClick={() => void test()} disabled={testing || !view.ready}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
      </div>
    </Collapsible>
  );
}

function ChatGptPanel({ view, onConnecting }: { view: ProviderView; onConnecting: () => void }) {
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
    onConnecting();
    flow.current = new ChatGptSignIn();
    setWaiting(true);
    setOutcome(null);
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
        {welcome && (
          <div className="space-y-1 rounded-lg border border-amber/50 bg-amber-soft p-3 text-[13px]">
            <p className="font-semibold">You're using your ChatGPT plan</p>
            <p className="text-muted">Siyaq's lookups now count toward your ChatGPT plan's usage instead of an API key. You can see and limit this in ChatGPT settings.</p>
            <button type="button" className="font-semibold text-amber" onClick={() => setWelcome(false)}>
              Got it
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px]">
            <span className="text-muted">Account</span>
            <span className="ml-3">{view.email ? <span className="font-semibold">{view.email}</span> : 'Signed in'}</span>
            <span className="ml-2 text-muted">· {view.planUsage ? 'Using ChatGPT plan' : 'Plan usage not allowed'}</span>
          </p>
          <span className="flex flex-wrap gap-2">
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
        <NoteBox note={outcome} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        Lookups use your ChatGPT plan's usage instead of an API key, at no extra cost from Siyaq. You can set a limit for Siyaq in ChatGPT settings. Signing in also asks Chrome to let Siyaq read the sign-in tab's address, which is how it receives the result.
      </p>
      {waiting ? (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
          <p className="text-[13px]">Finish signing in in the tab that just opened. This page updates by itself.</p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!flow.current?.submitAddress(pasted)) setOutcome({ ok: false, text: "That doesn't look like the sign-in result address. It starts with http://127.0.0.1." });
              setPasted('');
            }}
          >
            <input className="input min-w-[200px] flex-1 text-[13px]" placeholder="If nothing happens, paste the address of the tab that shows an error" aria-label="Address of the sign-in tab" value={pasted} onChange={(e) => setPasted(e.target.value)} spellCheck={false} />
            <button type="submit" className="btn shrink-0" disabled={!pasted.trim()}>
              Continue
            </button>
          </form>
          <button type="button" className="text-[13px] text-muted underline hover:text-text" onClick={() => flow.current?.cancel()}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => void signIn()} className="btn-primary px-4 py-2 text-[14px]">
          Continue with ChatGPT
        </button>
      )}
      <NoteBox note={outcome} />
    </div>
  );
}
