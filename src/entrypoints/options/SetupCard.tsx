import type { ReactNode } from 'react';
import { languageLabel } from '@/lib/languages';
import { providerInfo } from '@/lib/llm/providers';
import type { ProviderId } from '@/lib/llm/types';
import type { Prefs } from '@/lib/types';
import { CheckIcon } from '@/ui/components/icons';
import { levelLabel } from './ReadingSection';
import type { SetupState } from './status';

/** The letter on Siyaq's button, as it looks next to a selection. */
export function ButtonLetter() {
  return (
    <span className="mx-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface align-middle font-arabic text-[13px] font-bold leading-none text-amber" aria-label="Siyaq">
      س
    </span>
  );
}

function Step({ n, state, title, children }: { n: number; state: 'done' | 'now' | 'later'; title: string; children: ReactNode }) {
  const mark = state === 'done' ? 'bg-amber text-bg' : state === 'now' ? 'border border-amber text-amber' : 'border border-faint text-muted';
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${mark}`}>
        {state === 'done' ? <CheckIcon className="h-3.5 w-3.5" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[14px] font-semibold">
          {title}
          {state === 'done' && <span className="sr-only"> (done)</span>}
        </p>
        <div className="space-y-2 text-[13px] text-muted">{children}</div>
      </div>
    </li>
  );
}

/**
 * The top of the settings page while it has something to tell the reader: what to do on a new install,
 * how to use Siyaq once a new reader has connected a provider, and what is wrong when lookups cannot
 * work.
 */
export function SetupCard({
  state,
  finished,
  prefs,
  onGoToProvider,
  onDismiss,
}: {
  state: SetupState;
  /** The page opened with nothing connected and a provider is ready now. */
  finished: boolean;
  prefs: Prefs;
  onGoToProvider: (provider?: ProviderId) => void;
  onDismiss: () => void;
}) {
  if (state.kind === 'problem') {
    return (
      <section aria-labelledby="setup-title" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/60 bg-danger/10 p-5">
        <div className="space-y-1">
          <h2 id="setup-title" className="text-[16px] font-semibold">
            Lookups are not working
          </h2>
          <p className="text-[14px]">{state.reason}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => onGoToProvider(state.provider)}>
          Fix it
        </button>
      </section>
    );
  }
  if (state.kind === 'ready' && !finished) return null;

  // The same three steps before and after connecting, so the reader sees the second one get done.
  const ready = state.kind === 'ready';
  return (
    <section aria-labelledby="setup-title" className="space-y-4 rounded-2xl border border-amber/50 bg-amber-soft p-5">
      <div className="space-y-1">
        <h2 id="setup-title" className="text-[16px] font-semibold">
          {ready ? "You're ready" : 'Welcome to Siyaq'}
        </h2>
        <p className="text-[14px]">{ready ? 'Siyaq can now explain English for you on any page.' : 'One step is left before Siyaq can explain English for you.'}</p>
      </div>
      <ol className="space-y-4">
        <Step n={1} state="done" title="Your language and level">
          <p>
            {languageLabel(prefs.language)} · {levelLabel(prefs.level)}. You can change both below.
          </p>
        </Step>
        {ready ? (
          <Step n={2} state="done" title="Connect an AI provider">
            <p>Lookups use {providerInfo(state.provider).name}.</p>
          </Step>
        ) : (
          <Step n={2} state="now" title="Connect an AI provider">
            <p>An AI service writes Siyaq's answers. You connect it with your own key or account.</p>
            <button type="button" className="btn-primary" onClick={() => onGoToProvider()}>
              Connect a provider
            </button>
          </Step>
        )}
        <Step n={3} state={ready ? 'now' : 'later'} title="Try it on a page">
          {ready ? (
            <>
              <p>
                Open an article in English, select a word or a sentence, then click the <ButtonLetter /> button that appears next to it. Siyaq's toolbar button gives you a summary of the page and opens your saved words.
              </p>
              <button type="button" className="btn-primary" onClick={onDismiss}>
                Got it
              </button>
            </>
          ) : (
            <p>
              Select English text on any page, then click the <ButtonLetter /> button next to it.
            </p>
          )}
        </Step>
      </ol>
    </section>
  );
}
