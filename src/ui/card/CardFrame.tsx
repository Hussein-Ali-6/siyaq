import { useLayoutEffect, useRef, useState } from 'react';
import { BackIcon, BookIcon, CloseIcon, StarIcon } from '@/ui/components/icons';
import { DictionaryView } from './DictionaryView';
import { ErrorView } from './ErrorView';
import { LoadingView } from './LoadingView';
import { SummaryView } from './SummaryView';
import { TranslationView } from './TranslationView';
import type { CardActions, CardState, PageRect } from './state';

const WIDTH = 400;
const GAP = 8;
const MARGIN = 8;

function computePosition(anchor: PageRect, height: number): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = window.scrollX;
  const sy = window.scrollY;
  const width = Math.min(WIDTH, vw * 0.92);
  const left = Math.min(Math.max(anchor.left, sx + MARGIN), sx + vw - width - MARGIN);
  const below = anchor.bottom + GAP;
  const fitsBelow = below + height <= sy + vh - MARGIN;
  const above = anchor.top - GAP - height;
  const fitsAbove = above >= sy + MARGIN;
  if (fitsBelow || !fitsAbove) return { top: below, left };
  return { top: above, left };
}

export function CardFrame({ state, actions }: { state: CardState; actions: CardActions }) {
  const card = state.card!;
  const entry = card.stack[card.stack.length - 1]!;
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => computePosition(card.anchor, 200));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setPos(computePosition(card.anchor, el.offsetHeight));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [card.anchor, entry.key, entry.status, card.showSummary]);

  const isWord = entry.kind === 'word';
  const ready = entry.status === 'ready' && entry.card;
  let title: string;
  if (card.showSummary) title = 'Article summary';
  else if (entry.status === 'loading') title = isWord ? 'Looking up…' : 'Translating…';
  else if (entry.status === 'error') title = isWord ? entry.selection : 'Translation';
  else if (entry.card?.kind === 'word') title = entry.card.headword;
  else title = 'Translation';
  const pos_ = ready && entry.card?.kind === 'word' && !card.showSummary ? entry.card.partOfSpeech : '';

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Siyaq"
      className="absolute flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-text shadow-card"
      style={{ top: pos.top, left: pos.left, width: WIDTH, maxWidth: '92vw', maxHeight: 'min(70vh, 620px)' }}
    >
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        {card.stack.length > 1 && !card.showSummary && (
          <button type="button" onClick={actions.back} title="Back" aria-label="Back" className="-ml-1 mt-0.5 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text">
            <BackIcon />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className={`truncate text-[17px] font-semibold leading-tight ${ready && isWord ? 'text-amber' : ''}`}>{title}</h2>
          {pos_ && <p className="text-[12px] text-muted">{pos_}</p>}
        </div>
        <button
          type="button"
          onClick={actions.toggleSummary}
          title={card.showSummary ? 'Back to the card' : 'Article summary'}
          aria-pressed={card.showSummary}
          className={`rounded-md p-1 hover:bg-surface-2 ${card.showSummary ? 'bg-amber-soft text-amber' : 'text-muted hover:text-text'}`}
        >
          <BookIcon />
        </button>
        <button type="button" onClick={actions.close} title="Close (Esc)" aria-label="Close" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text">
          <CloseIcon />
        </button>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {card.showSummary ? (
          <SummaryView summary={state.summary} />
        ) : entry.status === 'loading' ? (
          <LoadingView selection={entry.selection} kind={entry.kind} />
        ) : entry.status === 'error' && entry.error ? (
          <ErrorView error={entry.error} onRetry={actions.retry} onSettings={actions.openSettings} />
        ) : entry.card?.kind === 'word' ? (
          <DictionaryView card={entry.card} segments={entry.sentenceSegments} sentence={entry.sentence} />
        ) : entry.card?.kind === 'sentence' ? (
          <TranslationViewLazy state={state} actions={actions} />
        ) : null}
      </div>

      {ready && !card.showSummary && (
        <footer className="flex items-center justify-between border-t border-border px-4 py-2">
          <button
            type="button"
            onClick={actions.toggleSave}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${entry.saved ? 'text-amber' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
            aria-pressed={entry.saved}
          >
            <StarIcon filled={entry.saved} />
            {entry.saved ? 'Saved' : 'Save'}
          </button>
          <span className="text-[11px] text-faint">Claude · Sonnet 5.5</span>
        </footer>
      )}
    </div>
  );
}

function TranslationViewLazy({ state, actions }: { state: CardState; actions: CardActions }) {
  const entry = state.card!.stack[state.card!.stack.length - 1]!;
  if (entry.card?.kind !== 'sentence') return null;
  return <TranslationView card={entry.card} selection={entry.selection} onKeyExpression={actions.openKeyExpression} />;
}
