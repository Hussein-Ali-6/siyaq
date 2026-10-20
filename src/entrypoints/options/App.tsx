import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { sendMessage } from '@/lib/messaging';
import { cacheStats } from '@/lib/storage/cache';
import { setPrefs } from '@/lib/storage/settings';
import type { Prefs } from '@/lib/types';
import { useTheme } from '@/ui/components/useTheme';
import { ProviderSection } from './ProviderSection';

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="space-y-1">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {intro && <p className="text-[13px] text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export function App() {
  const theme = useTheme();
  const [stats, setStats] = useState<{ cards: number; summaries: number } | null>(null);
  const [note, setNote] = useState('');

  const refreshStats = () => void cacheStats().then(setStats);
  useEffect(refreshStats, []);

  const clearCache = async () => {
    const { removed } = await sendMessage('clearCaches');
    setNote(`Removed ${removed} cached answers and summaries.`);
    refreshStats();
  };

  return (
    <main className="mx-auto max-w-[820px] space-y-6 px-6 py-10">
      <header className="flex items-baseline gap-3">
        <span className="text-[26px] font-bold leading-none text-amber">Siyaq</span>
        <h1 className="text-[22px] font-semibold">Settings</h1>
      </header>

      <Section title="AI provider" intro="Choose which AI answers your lookups. Pick a provider, connect it, choose a model, then press Use for lookups.">
        <ProviderSection />
      </Section>

      <Section title="Appearance">
        <div className="flex gap-4 text-[13px]">
          {(['dark', 'light'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input type="radio" name="theme" checked={theme === t} onChange={() => void setPrefs({ theme: t as Prefs['theme'] })} className="accent-amber" />
              {t === 'dark' ? 'Dark (default)' : 'Light'}
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="Data"
        intro={`Answers are cached per provider and model, page, paragraph and selection, so repeating a lookup costs nothing.${stats ? ` Cached now: ${stats.cards} answers, ${stats.summaries} summaries.` : ''}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn" onClick={() => void clearCache()}>
            Clear cached answers
          </button>
          <button type="button" className="btn" onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/words.html') })}>
            ★ Open My words
          </button>
          {note && <span className="text-[13px] text-amber">{note}</span>}
        </div>
      </Section>

      <section className="space-y-2 px-1 text-[12.5px] text-muted">
        <h2 className="text-[13px] font-semibold text-text">Privacy</h2>
        <p>
          Nothing leaves the browser until you click the Siyaq button next to a selection. Each request sends the page title, the paragraph around the selection, the selection, and the article summary once it exists, to the provider you chose, using your key or your ChatGPT sign-in. Keys and sign-in tokens stay in this browser profile and are only sent to their own provider. A speaker button sends that word or sentence to Google's voice service, and the YouGlish and Oxford links send the word to those sites, only when you click them. Nothing is logged except error codes.
        </p>
      </section>
    </main>
  );
}
