import { HOST_TAG, PARAGRAPH_MAX_WORDS, PARAGRAPH_MIN_WORDS, nearestBlock, widenParagraph } from '@/lib/dom/blocks';
import { buildFlatModel, rangeToSpan, spanToRange, type FlatModel } from '@/lib/dom/flat';
import { buildSentencePassage, buildWordPassage, sentenceWindowByWords } from '@/lib/text/tokens';
import { classifySelection, countWords, normalizeWhitespace } from '@/lib/text/words';
import type { CardKind, LookupRequest, PageContext, Passage, Span } from '@/lib/types';

export interface SelectionInfo {
  kind: CardKind;
  /** Trimmed selected text. */
  text: string;
  range: Range;
  /** The block containing the start of the selection. */
  block: Element;
}

function elementOf(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

export function isEditable(node: Node | null): boolean {
  let el = elementOf(node);
  while (el) {
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if ((el as HTMLElement).isContentEditable === true) return true;
    const attr = el.getAttribute('contenteditable');
    if (attr !== null) return attr !== 'false';
    el = el.parentElement;
  }
  return false;
}

function insideHost(node: Node | null): boolean {
  let el = elementOf(node);
  while (el) {
    if (el.tagName.toLowerCase() === HOST_TAG) return true;
    el = el.parentElement;
  }
  return false;
}

function startNode(range: Range): Node {
  const c = range.startContainer;
  if (c.nodeType === Node.ELEMENT_NODE) return c.childNodes[range.startOffset] ?? c;
  return c;
}

/** The current selection as a lookup candidate, or null when it should not trigger the icon. */
export function readSelection(doc: Document): SelectionInfo | null {
  const sel = doc.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const text = range.toString().trim();
  const kind = classifySelection(text);
  if (!kind) return null;
  if (isEditable(range.startContainer) || isEditable(range.endContainer)) return null;
  if (doc.activeElement && isEditable(doc.activeElement)) return null;
  if (insideHost(range.startContainer) || insideHost(range.endContainer)) return null;
  return { kind, text, range, block: nearestBlock(startNode(range)) };
}

export interface BuiltRequest {
  request: LookupRequest;
  /** DOM ranges for the given passage indices, for highlighting. */
  rangeForIndices(passage: Passage, indices: number[]): Range[];
}

function rangesFor(model: FlatModel, windowStart: number): BuiltRequest['rangeForIndices'] {
  return (passage, indices) =>
    indices.flatMap((i) => {
      const tok = passage.tokens.find((t) => t.i === i);
      if (!tok) return [];
      const range = spanToRange(model, { start: windowStart + tok.start, end: windowStart + tok.end });
      return range ? [range] : [];
    });
}

/**
 * The widened paragraph, or, when the block itself is oversized (pages that separate paragraphs
 * with <br> instead of <p>), a window of whole sentences around the selection.
 */
function paragraphFor(info: SelectionInfo, model: FlatModel, sel: Span): string {
  const { text } = widenParagraph(info.block);
  if (countWords(text) <= PARAGRAPH_MAX_WORDS) return text;
  const span = sentenceWindowByWords(model.text, sel, { min: PARAGRAPH_MIN_WORDS, max: PARAGRAPH_MAX_WORDS });
  return normalizeWhitespace(model.text.slice(span.start, span.end));
}

export function buildLookupRequest(info: SelectionInfo, page: PageContext): BuiltRequest {
  if (info.kind === 'word') {
    const model = buildFlatModel(info.block);
    const sel = rangeToSpan(model, info.range);
    const { passage, windowStart, selectedIndices } = buildWordPassage(model.text, sel);
    const request: LookupRequest = {
      kind: 'word',
      page,
      paragraph: paragraphFor(info, model, sel),
      selection: normalizeWhitespace(info.text),
      passage,
      selectedIndices,
    };
    return { request, rangeForIndices: rangesFor(model, windowStart) };
  }

  const ancestor = info.range.commonAncestorContainer;
  const root = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : (ancestor.parentNode ?? ancestor);
  const model = buildFlatModel(root);
  const sel = rangeToSpan(model, info.range);
  const passage = buildSentencePassage(model.text.slice(sel.start, sel.end));
  const request: LookupRequest = {
    kind: 'sentence',
    page,
    paragraph: paragraphFor(info, model, sel),
    selection: normalizeWhitespace(passage.text),
    passage,
    selectedIndices: passage.tokens.map((t) => t.i),
  };
  return { request, rangeForIndices: rangesFor(model, sel.start) };
}
