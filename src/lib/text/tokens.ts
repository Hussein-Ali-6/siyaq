import type { Passage, Segment, Span, Token } from '@/lib/types';

const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
const wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' });

/** A sentence that ends with one of these is almost never a real sentence end; merge it with the next. */
const ABBREVIATION_END =
  /(?:\b(?:Dr|Mr|Mrs|Ms|Mx|Prof|Sr|Jr|St|Mt|Ft|vs|cf|e\.g|i\.e|No|Fig|Gen|Sen|Rep|Gov|Lt|Col|Capt|Sgt|Inc|Ltd|Co|Corp)|\b[A-Z])\.$/;

function trimSpan(text: string, start: number, end: number): Span | null {
  while (start < end && text[start] === ' ') start++;
  while (end > start && text[end - 1] === ' ') end--;
  return start < end ? { start, end } : null;
}

/**
 * Sentence spans in `text` (offsets into the original text, whitespace trimmed).
 * Every whitespace character is treated as a plain space so soft line breaks inside a
 * sentence do not split it.
 */
export function segmentSentences(text: string): Span[] {
  const flat = text.replace(/\s/g, ' ');
  const spans: Span[] = [];
  for (const seg of sentenceSegmenter.segment(flat)) {
    const span = trimSpan(flat, seg.index, seg.index + seg.segment.length);
    if (!span) continue;
    const prev = spans[spans.length - 1];
    if (prev && ABBREVIATION_END.test(flat.slice(prev.start, prev.end))) {
      prev.end = span.end;
    } else {
      spans.push(span);
    }
  }
  return spans;
}

/** Word-like tokens of `text`, numbered from `firstIndex`, with offsets shifted by `base`. */
export function tokenizeWords(text: string, base = 0, firstIndex = 1): Token[] {
  const tokens: Token[] = [];
  let i = firstIndex;
  for (const seg of wordSegmenter.segment(text)) {
    if (!seg.isWordLike) continue;
    tokens.push({ i: i++, t: seg.segment, start: base + seg.index, end: base + seg.index + seg.segment.length });
  }
  return tokens;
}

export function buildSentencePassage(text: string): Passage {
  return { text, tokens: tokenizeWords(text), sentence: null };
}

/** The passage with `[i]` inserted before every token: "[1]They [2]turned ... [5]down, [6]surprisingly." */
export function buildNumberedPassage(passage: Passage): string {
  const { text, tokens } = passage;
  let out = '';
  let pos = 0;
  for (const tok of tokens) {
    out += text.slice(pos, tok.start) + `[${tok.i}]` + text.slice(tok.start, tok.end);
    pos = tok.end;
  }
  out += text.slice(pos);
  return out.replace(/\s+/g, ' ').trim();
}

/** Indices of the tokens that overlap `sel` (offsets relative to the same text as the tokens). */
export function selectedTokenIndices(tokens: Token[], sel: Span): number[] {
  return tokens.filter((t) => t.start < sel.end && t.end > sel.start).map((t) => t.i);
}

/** The sentence containing the start of `sel`, and a window of that sentence ±1. */
export function sentenceWindow(text: string, sel: Span): { window: Span; sentence: Span } {
  const sentences = segmentSentences(text);
  if (sentences.length === 0) {
    const all = { start: 0, end: text.length };
    return { window: all, sentence: all };
  }
  let k = sentences.findIndex((s) => sel.start < s.end);
  if (k === -1) k = sentences.length - 1;
  const sentence = sentences[k]!;
  const first = sentences[Math.max(0, k - 1)]!;
  const last = sentences[Math.min(sentences.length - 1, k + 1)]!;
  return { window: { start: first.start, end: last.end }, sentence: { ...sentence } };
}

/**
 * Builds the numbered passage for a word lookup: the selection's sentence ±1, tokenised,
 * with the selected token indices. `windowStart` maps passage offsets back into `flatText`.
 */
export function buildWordPassage(
  flatText: string,
  sel: Span,
): { passage: Passage; windowStart: number; selectedIndices: number[] } {
  const { window, sentence } = sentenceWindow(flatText, sel);
  const text = flatText.slice(window.start, window.end);
  const tokens = tokenizeWords(text);
  const localSel = { start: sel.start - window.start, end: sel.end - window.start };
  const passage: Passage = {
    text,
    tokens,
    sentence: { start: sentence.start - window.start, end: sentence.end - window.start },
  };
  return { passage, windowStart: window.start, selectedIndices: selectedTokenIndices(tokens, localSel) };
}

export type IndexCheck = { ok: true; indices: number[] } | { ok: false; reason: string };

/**
 * Strict check of indices returned by the model: integers, inside the passage, and (when there
 * is a selection anchor) overlapping the selected words. Returns them sorted and unique.
 */
export function validateIndices(indices: unknown, passage: Passage, selected: number[]): IndexCheck {
  if (!Array.isArray(indices) || indices.length === 0) {
    return { ok: false, reason: 'indices must be a non-empty array of integers' };
  }
  if (!indices.every((n) => Number.isInteger(n))) {
    return { ok: false, reason: 'indices must be integers' };
  }
  const max = passage.tokens.length;
  const unique = [...new Set(indices as number[])].sort((a, b) => a - b);
  if (unique.some((n) => n < 1 || n > max)) {
    return { ok: false, reason: `indices must be between 1 and ${max}, taken from the numbered passage` };
  }
  if (selected.length > 0 && !unique.some((n) => selected.includes(n))) {
    return { ok: false, reason: 'the unit must include the selected word' };
  }
  return { ok: true, indices: unique };
}

/** The selection's sentence as text runs, with the unit's tokens marked bold. */
export function sentenceSegments(passage: Passage, indices: number[]): Segment[] {
  const span = passage.sentence ?? { start: 0, end: passage.text.length };
  const unit = new Set(indices);
  const segments: Segment[] = [];
  let pos = span.start;
  for (const tok of passage.tokens) {
    if (tok.end <= span.start || tok.start >= span.end || !unit.has(tok.i)) continue;
    if (tok.start > pos) segments.push({ text: passage.text.slice(pos, tok.start) });
    segments.push({ text: passage.text.slice(tok.start, tok.end), bold: true });
    pos = tok.end;
  }
  if (pos < span.end) segments.push({ text: passage.text.slice(pos, span.end) });
  return segments;
}

/** The unit as it appears in the text: "turned … down". */
export function surfaceForm(passage: Passage, indices: number[]): string {
  const unit = new Set(indices);
  const tokens = passage.tokens.filter((t) => unit.has(t.i));
  let out = '';
  tokens.forEach((tok, k) => {
    if (k > 0) out += tokens[k - 1]!.i === tok.i - 1 ? ' ' : ' … ';
    out += tok.t;
  });
  return out;
}
