import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { EFFORT, MODEL } from '@/lib/claude/client';
import { sendMessage } from '@/lib/messaging';
import { cacheStats } from '@/lib/storage/cache';
import { getApiKey, getPrefs, setApiKey, setPrefs } from '@/lib/storage/settings';
import { useTheme } from '@/ui/components/useTheme';
import type { Prefs } from '@/lib/types';

export function App() {
  const theme = useTheme();
  const [key, setKey] = useState('');
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<{ cards: number; summaries: number } | null>(null);

  const refreshStats = () => void cacheStats().then(setStats);

  useEffect(() => {
    void getApiKey().then((k) => {
      setStoredKey(k);
      setKey(k ?? '');
    });
    refreshStats();
  }, []);

  async function save() {
    await setApiKey(key);
    const stored = await getApiKey();
    setStoredKey(stored);
    setNote(stored ? { ok: true, text: 'Key saved. It stays in this browser profile only.' } : { ok: true, text: 'Key removed.' });
  }

  async function test() {
    setTesting(true);
    setNote(null);
    try {
      await setApiKey(key);
      setStoredKey(await getApiKey());
      const result = await sendMessage('testApiKey');
      setNote({ ok: result.ok, text: result.message });
    } finally {
      setTesting(false);
    }
  }

  async function changeTheme(next: Prefs['theme']) {
    await setPrefs({ theme: next });
  }

  async function clearCache() {
    const { removed } = await sendMessage('clearCaches');
    setNote({ ok: true, text: `Removed ${removed} cached answers and summaries.` });
    refreshStats();
  }

  return (
    <main className="mx-auto max-w-[640px] px-6 py-10">
      <header className="mb-8 flex items-baseline gap-3">
        <span className="text-[26px] font-bold leading-none text-amber">Siyaq</span>
        <h1 className="text-[22px] font-semibold">Settings</h1>
      </header>

      <section className="mb-8 space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Anthropic API key</h2>
        <p className="text-[13px] text-muted">
          Create a key in the Anthropic Console. It is stored in this browser profile only (<code>chrome.storage.local</code>), never synced, and only the
          extension's background service reads it.
        </p>
        <div className="flex gap-2">
          <input
            className="input font-mono"
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn" onClick={() => setShow((s) => !s)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-primary" onClick={save}>
            Save
          </button>
          <button type="button" className="btn" onClick={test} disabled={testing || !key.trim()}>
            {testing ? 'Testing…' : 'Save and test'}
          </button>
          <span className="text-[12px] text-muted">{storedKey ? 'A key is saved.' : 'No key saved yet.'}</span>
        </div>
        {note && <p className={`text-[13px] ${note.ok ? 'text-amber' : 'text-danger'}`}>{note.text}</p>}
        <p className="text-[12px] text-faint">
          Model: {MODEL}, effort {EFFORT}, structured outputs, cached system prompts. Each lookup costs a fraction of a cent.
        </p>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Appearance</h2>
        <div className="flex gap-4 text-[13px]">
          {(['dark', 'light'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" name="theme" checked={theme === t} onChange={() => void changeTheme(t)} className="accent-amber" />
              {t === 'dark' ? 'Dark (default)' : 'Light'}
            </label>
          ))}
        </div>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Data</h2>
        <p className="text-[13px] text-muted">
          Answers are cached by page, paragraph and selection so repeating a lookup costs nothing.
          {stats && ` Cached now: ${stats.cards} answers, ${stats.summaries} summaries.`}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={clearCache}>
            Clear cached answers
          </button>
          <button type="button" className="btn" onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/words.html') })}>
            ★ Open My words
          </button>
        </div>
      </section>

      <section className="space-y-2 text-[12.5px] text-muted">
        <h2 className="text-[13px] font-semibold text-text">Privacy</h2>
        <p>Nothing leaves the browser until you click the Siyaq icon next to a selection. Each request sends the page title, the paragraph around the selection, the selection, and the article summary once it exists, to the Anthropic API with your key. Nothing is logged except error codes.</p>
      </section>
    </main>
  );
}
