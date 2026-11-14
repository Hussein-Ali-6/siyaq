import cssText from '../../src/entrypoints/content/style.css?inline';
import { setHighlight } from '@/lib/dom/highlight';
import { createCardUi } from '@/ui/card/mount';
import { initialCardState, type CardActions, type CardEntry, type CardState } from '@/ui/card/state';
import { cornersSelection, cornersTranslation, summary, turnDown, turnDownSegments, turnDownSentence } from './fixtures';

const noop = () => undefined;
const actions: CardActions = {
  openFromIcon: noop,
  close: noop,
  back: noop,
  toggleSummary: noop,
  retry: noop,
  toggleSave: noop,
  openKeyExpression: noop,
  openSettings: noop,
};

function rangeOf(id: string): Range {
  const range = document.createRange();
  range.selectNodeContents(document.getElementById(id)!);
  return range;
}

/** Page-coordinate rectangle of a range, as the content script passes it to the card. */
function anchorOf(range: Range) {
  const r = range.getBoundingClientRect();
  return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left + scrollX, right: r.right + scrollX };
}

const model = 'anthropic:claude-sonnet-5-5';
const page = document.querySelector<HTMLElement>('.page')!;

const dictionaryEntry = (): CardEntry => ({
  key: 'd',
  kind: 'word',
  selection: 'turned',
  status: 'ready',
  card: turnDown,
  id: 'd',
  sentence: turnDownSentence,
  sentenceSegments: turnDownSegments,
  saved: true,
  model,
});

function scene(name: string): { state: CardState; highlight: Range[] } {
  const base = initialCardState();
  if (name === 'translation') {
    const range = rangeOf('t-sentence');
    // Shown mid-article, so the card fits below the selection. The article is shifted up rather than
    // scrolled, because headless Chrome does not repaint a scripted scroll before its screenshot.
    page.style.marginTop = '0px';
    page.style.marginTop = `${150 - range.getBoundingClientRect().top}px`;
    const entry: CardEntry = { key: 't', kind: 'sentence', selection: cornersSelection, status: 'ready', card: cornersTranslation, id: 't', saved: false, model };
    return { state: { ...base, card: { anchor: anchorOf(range), showSummary: false, stack: [entry] } }, highlight: [range] };
  }
  page.style.marginTop = '';
  const turned = rangeOf('t-turned');
  const highlight = [turned, rangeOf('t-down')];
  if (name === 'summary') {
    return {
      state: { ...base, summary: { status: 'ready', summary }, card: { anchor: anchorOf(turned), showSummary: true, stack: [dictionaryEntry()] } },
      highlight,
    };
  }
  return { state: { ...base, card: { anchor: anchorOf(turned), showSummary: false, stack: [dictionaryEntry()] } }, highlight };
}

const ui = createCardUi(document, cssText, 'siyaq-root');
function show() {
  const { state, highlight } = scene(decodeURIComponent(location.hash.slice(1)) || 'dictionary');
  setHighlight(highlight);
  ui.render(state, actions);
}
addEventListener('hashchange', show);
// Wait for web fonts so line breaks, and so the anchors, are final.
void document.fonts.ready.then(show);
