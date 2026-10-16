import type { CardKind } from '@/lib/types';

/** Up to this many words is a dictionary lookup; more is a translation. */
export const MAX_WORD_LOOKUP = 4;
/** Translation selections longer than this are refused. */
export const MAX_SELECTION_WORDS = 400;

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

export function countWords(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

export function classifySelection(text: string): CardKind | null {
  const n = countWords(text);
  if (n === 0) return null;
  return n <= MAX_WORD_LOOKUP ? 'word' : 'sentence';
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
