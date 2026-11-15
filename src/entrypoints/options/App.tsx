import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { sendMessage } from '@/lib/messaging';
import type { ProviderId } from '@/lib/llm/types';
import { cacheStats } from '@/lib/storage/cache';
import { setPrefs } from '@/lib/storage/settings';
import type { Prefs } from '@/lib/types';
import { Collapsible } from '@/ui/components/Collapsible';
import { StarIcon } from '@/ui/components/icons';
import { useTheme } from '@/ui/components/useTheme';
import { NoteBox, Section, Segmented } from './controls';
import { ProviderSection } from './ProviderSection';
import { ReadingSection } from './ReadingSection';
import { SavedMessage, useSaved } from './saved-message';
import { ButtonLetter, SetupCard } from './SetupCard';
import { setupState, type ProviderViews } from './status';
import { usePrefs } from './usePrefs';
import { useProviders } from './useProviders';

const THEMES: ReadonlyArray<{ id: Prefs['theme']; label: string }> = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const openWords = () => void browser.tabs.create({ url: browser.runtime.getURL('/words.html') });

export function App() {
  useTheme();
  const prefs = usePrefs();
  const { views, active } = useProviders();

  return (
    <SavedMessage>
      <main className="mx-auto max-w-[760px] space-y-5 px-5 py-8 sm:py-10">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[22px] font-bold leading-none text-amber">Siyaq</span>
            <h1 className="text-[22px] font-semibold leading-none">Settings</h1>
            <button type="button" className="btn ml-auto" onClick={openWords}>
              <StarIcon className="h-3.5 w-3.5 text-amber" filled />
              My words
            </button>
          </div>
          <p className="text-[14px] text-muted">
            Select English text on any page, then click the <ButtonLetter /> button next to it.
          </p>
        </header>

        {views && prefs ? <Settings views={views} active={active} prefs={prefs} /> : <p className="text-[13px] text-muted">Loading…</p>}
      </main>
    </SavedMessage>
  );
}

/** The latest value, except while `hold` is true, when the value from before is kept. */
function useHeld<T>(value: T, hold: boolean): T {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    if (!hold) setHeld(value);
  }, [value, hold]);
  return hold ? held : value;
}

const scrolling = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

function Settings({ views: latest, active, prefs }: { views: ProviderViews; active: ProviderId; prefs: Prefs }) {
  const saved = useSaved();
  // Connecting a key stores it before it is tested. Until the test has ended the page shows the
  // providers as they were, so a key that is rejected never appears as connected.
  const [busy, setBusy] = useState(false);
  const views = useHeld(latest, busy);
  const setup = setupState(views, active);
  // The row that is open. On a page that opens ready, none; otherwise the provider that needs attention.
  const [open, setOpen] = useState<ProviderId | null>(() => (setup.kind === 'ready' ? null : setup.kind === 'problem' ? setup.provider : active));
  const openedAs = useRef(setup.kind);
  const [dismissed, setDismissed] = useState(false);
  // A new reader has just connected a provider: the setup card turns to its last step.
  const finished = openedAs.current === 'welcome' && setup.kind === 'ready';

  // Show the reader the setup card's last step. The scroll waits for the page to settle: the card
  // changes height as it turns, and the browser's own correction for that would stop a scroll in progress.
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => window.scrollTo({ top: 0, behavior: scrolling() }), 150);
    return () => clearTimeout(timer);
  }, [finished]);

  const goToProvider = (provider: ProviderId = open ?? active) => {
    setOpen(provider);
    const section = document.getElementById('provider');
    section?.scrollIntoView({ behavior: scrolling(), block: 'start' });
    // Once the row has opened, put the cursor in its key field without scrolling a second time.
    setTimeout(() => section?.querySelector<HTMLInputElement>('[data-key-input]')?.focus({ preventScroll: true }), 0);
  };

  return (
    <>
      <SetupCard state={setup} finished={finished && !dismissed} prefs={prefs} onGoToProvider={goToProvider} onDismiss={() => setDismissed(true)} />

      <Section id="reading" title="Language and level" intro="The language of the translations, and how much the cards explain.">
        <ReadingSection prefs={prefs} />
      </Section>

      <Section id="provider" title="AI provider" intro="The AI service that writes Siyaq's answers. Connect one with your own key or account. If you connect more than one, you choose which one lookups use.">
        <ProviderSection views={views} active={active} open={open} onOpen={setOpen} busy={busy} onBusy={setBusy} />
      </Section>

      <Section id="theme" title="Theme" aside={<Segmented label="Theme" options={THEMES} value={prefs.theme} onChange={(theme) => void setPrefs({ theme }).then(saved)} />} />

      <StoredAnswers />
      <Privacy />
    </>
  );
}

function StoredAnswers() {
  const [stats, setStats] = useState<{ cards: number; summaries: number } | null>(null);
  const [note, setNote] = useState('');

  const refresh = () => void cacheStats().then(setStats);
  useEffect(refresh, []);

  const clear = async () => {
    const { removed } = await sendMessage('clearCaches');
    setNote(`Removed ${count(removed, 'stored item', 'stored items')}.`);
    refresh();
  };

  return (
    <Section
      id="stored"
      title="Stored answers"
      intro="Siyaq keeps the answers it has given, so looking up the same text again is instant and costs nothing."
      aside={
        <button type="button" className="btn" onClick={() => void clear()}>
          Clear stored answers
        </button>
      }
    >
      <p className="text-[13px] text-muted">
        {stats ? `Stored now: ${count(stats.cards, 'answer', 'answers')} and ${count(stats.summaries, 'summary', 'summaries')}. ` : ''}
        Clearing them does not delete your saved words, which are on the{' '}
        <button type="button" className="text-text underline hover:text-amber" onClick={openWords}>
          My words
        </button>{' '}
        page.
      </p>
      {note && <NoteBox note={{ ok: true, text: note }} />}
    </Section>
  );
}

function Privacy() {
  return (
    <Section id="privacy" title="Privacy" intro="Nothing leaves the browser until you click the Siyaq button next to a selection.">
      <Collapsible title="What is sent, and where">
        <ul className="list-disc space-y-2 pl-5 text-[13px] text-muted">
          <li>
            Each lookup sends the selection, the paragraph around it, the page title, the site name, the article summary once it exists, the name of your translation language and your English level to the provider you chose, using your key or your ChatGPT sign-in.
          </li>
          <li>Writing the article summary, which the first card on a page starts, also sends the article's main text (up to 4,000 words) to the same provider.</li>
          <li>Keys and sign-in tokens stay in this browser profile and are only sent to their own provider.</li>
          <li>A speaker button sends that word or sentence to Google's voice service, and the YouGlish and Oxford links send the word to those sites, only when you click them.</li>
          <li>Nothing is logged except error codes.</li>
        </ul>
      </Collapsible>
    </Section>
  );
}
