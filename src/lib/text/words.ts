import type { CardKind } from '@/lib/types';

/** Up to this many words is a dictionary lookup; more is a translation. */
export const MAX_WORD_LOOKUP = 4;
/** Translation selections longer than this are refused. */
export const MAX_SELECTION_WORDS = 400;

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

export function countWords(text: string): number {
  return (text.match(WORD_RE) ?? []).length;
}

const LETTER_RE = /\p{L}/gu;
const LATIN_RE = /\p{Script=Latin}/gu;

/**
 * True when the text has letters and most of them are Latin, i.e. English. Arabic, other scripts,
 * and selections of only numbers, symbols or emoji are not looked up.
 */
export function isMostlyEnglish(text: string): boolean {
  const letters = text.match(LETTER_RE)?.length ?? 0;
  if (letters === 0) return false;
  const latin = text.match(LATIN_RE)?.length ?? 0;
  return latin * 2 > letters;
}

export function classifySelection(text: string): CardKind | null {
  if (!isMostlyEnglish(text)) return null;
  const n = countWords(text);
  if (n === 0) return null;
  return n <= MAX_WORD_LOOKUP ? 'word' : 'sentence';
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
