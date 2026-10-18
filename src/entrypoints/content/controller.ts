import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { extractArticle, pageSiteName } from '@/lib/dom/article';
import { HOST_TAG } from '@/lib/dom/blocks';
import { clearHighlight, setHighlight } from '@/lib/dom/highlight';
import { buildLookupRequest, readSelection, type BuiltRequest, type SelectionInfo } from '@/lib/dom/selection';
import { log } from '@/lib/log';
import { onMessage, sendMessage } from '@/lib/messaging';
import { sentenceSegments } from '@/lib/text/tokens';
import { normalizeWhitespace } from '@/lib/text/words';
import type { LookupRequest, LookupResponse, PageContext, UserError } from '@/lib/types';
import { createCardUi, type CardUi } from '@/ui/card/mount';
import { initialCardState, type CardActions, type CardEntry, type CardState, type PageRect, type SummaryState } from '@/ui/card/state';

interface EntryContext {
  request: LookupRequest;
  built: BuiltRequest;
  highlight: Range[];
}

const SELECTION_DEBOUNCE_MS = 160;

function pageRect(range: Range): PageRect {
  const r = range.getBoundingClientRect();
  return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left + scrollX, right: r.right + scrollX };
}

function messagingError(err: unknown): UserError {
  const text = err instanceof Error ? err.message : String(err);
  if (/context invalidated/i.test(text)) {
    return { code: 'unknown', message: 'Siyaq was updated. Reload this page to use it again.' };
  }
  log.warn('messaging_failed');
  return { code: 'unknown', message: 'Could not reach the Siyaq background service. Try again.' };
}

export class SiyaqController {
  private state: CardState = initialCardState();
  private readonly ui: CardUi;
  private readonly actions: CardActions;
  private pending: SelectionInfo | null = null;
  private contexts = new Map<string, EntryContext>();
  private page: PageContext = { url: location.href, title: document.title, siteName: pageSiteName(document) };
  private summaryUrl: string | null = null;
  private themeLoaded = false;
  private seq = 0;
  private selectionTimer = 0;
  private mouseDown = false;

  constructor(private readonly ctx: ContentScriptContext, cssText: string) {
    this.ui = createCardUi(document, cssText, HOST_TAG);
    this.actions = {
      openFromIcon: () => this.open(),
      close: () => this.close(),
      back: () => this.back(),
      toggleSummary: () => this.toggleSummary(),
      retry: () => this.retry(),
      toggleSave: () => void this.toggleSave(),
      openKeyExpression: (i) => this.openKeyExpression(i),
      openSettings: () => void sendMessage('openOptions').catch(() => undefined),
    };

    ctx.addEventListener(document, 'selectionchange', () => this.scheduleSelectionCheck());
    ctx.addEventListener(document, 'mousedown', (e) => this.onDocumentMouseDown(e), { capture: true });
    ctx.addEventListener(document, 'mouseup', () => this.onDocumentMouseUp(), { capture: true });
    ctx.addEventListener(document, 'keydown', (e) => this.onKeyDown(e));
    this.ui.host.addEventListener('keydown', (e) => this.onKeyDown(e));
    onMessage('extractArticle', () => extractArticle(document));
    ctx.onInvalidated(() => {
      clearHighlight();
      this.ui.destroy();
    });
    this.render();
  }

  private render(): void {
    this.ui.render(this.state, this.actions);
  }

  private topEntry(): CardEntry | undefined {
    const stack = this.state.card?.stack;
    return stack?.[stack.length - 1];
  }

  private isCurrent(entry: CardEntry): boolean {
    return this.state.card?.stack.includes(entry) ?? false;
  }

  // ---- selection and trigger icon ----

  private scheduleSelectionCheck(): void {
    window.clearTimeout(this.selectionTimer);
    this.selectionTimer = this.ctx.setTimeout(() => this.checkSelection(), SELECTION_DEBOUNCE_MS);
  }

  private checkSelection(): void {
    if (this.mouseDown) return;
    const info = readSelection(document);
    if (!info) {
      this.pending = null;
      if (this.state.icon) {
        this.state.icon = null;
        this.render();
      }
      return;
    }
    this.pending = info;
    const rects = info.range.getClientRects();
    const last = rects[rects.length - 1] ?? info.range.getBoundingClientRect();
    const x = Math.min(last.right + 6, window.innerWidth - 44) + scrollX;
    const y = last.bottom + 6 + scrollY;
    this.state.icon = { x, y };
    this.render();
  }

  private onDocumentMouseDown(e: MouseEvent): void {
    this.mouseDown = true;
    const target = e.target as Node | null;
    if (target && this.ui.host.contains(target)) return;
    if (this.state.card) this.close();
  }

  private onDocumentMouseUp(): void {
    this.mouseDown = false;
    this.scheduleSelectionCheck();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && (this.state.card || this.state.icon)) {
      e.preventDefault();
      this.close();
    }
  }

  // ---- card lifecycle ----

  private refreshPage(): void {
    const url = location.href;
    if (url !== this.page.url && this.summaryUrl !== url) this.state.summary = { status: 'idle' };
    this.page = { url, title: document.title, siteName: pageSiteName(document) };
  }

  private open(): void {
    const info = this.pending;
    if (!info) return;
    this.refreshPage();
    let built: BuiltRequest;
    try {
      built = buildLookupRequest(info, this.page);
    } catch {
      log.warn('build_request_failed');
      return;
    }
    const key = `e${++this.seq}`;
    const entry: CardEntry = { key, kind: built.request.kind, selection: built.request.selection, status: 'loading', saved: false };
    const tokenRanges = built.rangeForIndices(built.request.passage, built.request.selectedIndices);
    const highlight = tokenRanges.length ? tokenRanges : [info.range.cloneRange()];
    this.contexts.clear();
    this.contexts.set(key, { request: built.request, built, highlight });
    this.state.card = { anchor: pageRect(info.range), stack: [entry], showSummary: false };
    this.state.icon = null;
    this.pending = null;
    setHighlight(highlight);
    document.getSelection()?.removeAllRanges();
    this.render();
    void this.loadTheme();
    void this.runLookup(entry);
    this.ensureSummary();
  }

  private async loadTheme(): Promise<void> {
    if (this.themeLoaded) return;
    this.themeLoaded = true;
    try {
      const prefs = await sendMessage('getPrefs');
      if (prefs.theme !== this.state.theme) {
        this.state.theme = prefs.theme;
        this.render();
      }
    } catch {
      this.themeLoaded = false;
    }
  }

  private async runLookup(entry: CardEntry): Promise<void> {
    const context = this.contexts.get(entry.key);
    if (!context) return;
    let res: LookupResponse;
    try {
      res = await sendMessage('lookup', context.request);
    } catch (err) {
      res = { ok: false, error: messagingError(err) };
    }
    if (!this.isCurrent(entry)) return;
    if (!res.ok) {
      entry.status = 'error';
      entry.error = res.error;
      this.render();
      return;
    }
    entry.status = 'ready';
    entry.card = res.card;
    entry.id = res.id;
    const passage = context.request.passage;
    if (res.card.kind === 'word') {
      entry.sentenceSegments = sentenceSegments(passage, res.card.unitIndices);
      entry.sentence = normalizeWhitespace(
        passage.sentence ? passage.text.slice(passage.sentence.start, passage.sentence.end) : passage.text,
      );
      const ranges = context.built.rangeForIndices(passage, res.card.unitIndices);
      if (ranges.length) {
        context.highlight = ranges;
        if (this.topEntry() === entry) setHighlight(ranges);
      }
    } else {
      entry.sentence = entry.selection;
      entry.sentenceSegments = [{ text: entry.selection }];
    }
    this.render();
    try {
      entry.saved = await sendMessage('isSaved', res.id);
    } catch {
      /* not fatal */
    }
    if (this.isCurrent(entry)) this.render();
  }

  private retry(): void {
    const entry = this.topEntry();
    if (!entry) return;
    entry.status = 'loading';
    entry.error = undefined;
    this.render();
    void this.runLookup(entry);
  }

  private back(): void {
    const card = this.state.card;
    if (!card || card.stack.length < 2) return;
    const removed = card.stack.pop()!;
    this.contexts.delete(removed.key);
    const top = this.topEntry();
    const context = top ? this.contexts.get(top.key) : undefined;
    setHighlight(context?.highlight ?? []);
    this.render();
  }

  private close(): void {
    if (!this.state.card && !this.state.icon) return;
    this.state.card = null;
    this.state.icon = null;
    this.pending = null;
    this.contexts.clear();
    clearHighlight();
    this.render();
  }

  private async toggleSave(): Promise<void> {
    const entry = this.topEntry();
    if (!entry || entry.status !== 'ready' || !entry.card || !entry.id) return;
    try {
      if (entry.saved) {
        await sendMessage('unsaveItem', entry.id);
        entry.saved = false;
      } else {
        await sendMessage('saveItem', {
          id: entry.id,
          kind: entry.kind,
          card: entry.card,
          selection: entry.selection,
          sentence: entry.sentence ?? entry.selection,
          sentenceSegments: entry.sentenceSegments ?? [{ text: entry.selection }],
          pageTitle: this.page.title,
          url: this.page.url,
        });
        entry.saved = true;
      }
    } catch {
      log.warn('save_failed');
    }
    this.render();
  }

  private openKeyExpression(index: number): void {
    const card = this.state.card;
    const top = this.topEntry();
    const context = top ? this.contexts.get(top.key) : undefined;
    if (!card || !top || !context || top.card?.kind !== 'sentence') return;
    const expr = top.card.keyExpressions[index];
    if (!expr) return;
    const request: LookupRequest = {
      kind: 'word',
      page: context.request.page,
      paragraph: context.request.paragraph,
      selection: expr.expression,
      passage: context.request.passage,
      selectedIndices: expr.indices,
    };
    const key = `e${++this.seq}`;
    const entry: CardEntry = { key, kind: 'word', selection: expr.expression, status: 'loading', saved: false };
    const ranges = context.built.rangeForIndices(request.passage, expr.indices);
    const highlight = ranges.length ? ranges : context.highlight;
    this.contexts.set(key, { request, built: context.built, highlight });
    card.stack.push(entry);
    card.showSummary = false;
    setHighlight(highlight);
    this.render();
    void this.runLookup(entry);
  }

  // ---- article summary ----

  private toggleSummary(): void {
    const card = this.state.card;
    if (!card) return;
    card.showSummary = !card.showSummary;
    if (card.showSummary && (this.state.summary.status === 'idle' || this.state.summary.status === 'error')) {
      this.ensureSummary(true);
    }
    this.render();
  }

  private ensureSummary(force = false): void {
    const url = this.page.url;
    const active = this.summaryUrl === url && this.state.summary.status !== 'idle';
    if (active && !(force && this.state.summary.status === 'error')) return;
    this.summaryUrl = url;
    this.state.summary = { status: 'loading' };
    this.render();
    void (async () => {
      try {
        const cached = await sendMessage('getSummary', url);
        if (cached) {
          this.setSummary(url, { status: 'ready', summary: cached });
          return;
        }
        // Let the lookup message leave first; extraction clones the document and can take a moment.
        await new Promise((resolve) => setTimeout(resolve, 60));
        const article = extractArticle(document);
        const res = await sendMessage('summarize', { url, title: article.title, siteName: article.siteName, text: article.text });
        this.setSummary(url, res.ok ? { status: 'ready', summary: res.summary } : { status: 'error', error: res.error });
      } catch (err) {
        this.setSummary(url, { status: 'error', error: messagingError(err) });
      }
    })();
  }

  private setSummary(url: string, summary: SummaryState): void {
    if (this.summaryUrl !== url) return;
    this.state.summary = summary;
    this.render();
  }
}
