/** Shared data types used by the content script, service worker and extension pages. */

export type CardKind = 'word' | 'sentence';

export interface PageContext {
  url: string;
  title: string;
  siteName: string;
}

/** Character span, end exclusive. Offsets are relative to the text they were cut from. */
export interface Span {
  start: number;
  end: number;
}

/** A word-like token in a passage. `i` is the 1-based index shown to the model as `[i]word`. */
export interface Token extends Span {
  i: number;
  t: string;
}

/** The numbered passage sent to the model. Token offsets are relative to `text`. */
export interface Passage {
  text: string;
  tokens: Token[];
  /** Offsets (in `text`) of the sentence containing the selection; null for sentence cards. */
  sentence: Span | null;
}

export interface LookupRequest {
  kind: CardKind;
  page: PageContext;
  /** The paragraph containing the selection, widened with neighbours to 150–400 words. */
  paragraph: string;
  /** The selected text, trimmed. */
  selection: string;
  /** Word card: sentence ±1 as numbered tokens. Sentence card: the selection itself, numbered. */
  passage: Passage;
  /** Indices (into `passage.tokens`) of the words the reader selected. */
  selectedIndices: number[];
}

export interface OtherMeaning {
  meaning: string;
  arabic: string;
}

export interface DictionaryCard {
  kind: 'word';
  headword: string;
  partOfSpeech: string;
  /** Indices of the unit's words in the passage, verified against the request. */
  unitIndices: number[];
  meaning: string;
  /** The Arabic for this sense, with a short clarification when a single word would mislead. */
  arabic: string;
  /** Only on cards saved while the explanation was a separate field; shown and searched for those. */
  arabicMeaning?: string;
  notes: string[];
  sentenceArabic: string;
  examples: string[];
  combinations: string[];
  otherMeanings: OtherMeaning[];
}

export interface KeyExpression {
  expression: string;
  indices: number[];
  meaning: string;
  arabic: string;
}

export interface TranslationCard {
  kind: 'sentence';
  arabic: string;
  /** Empty when the original is easy to follow. */
  plainEnglish: string;
  keyExpressions: KeyExpression[];
}

export type Card = DictionaryCard | TranslationCard;

export interface Summary {
  english: string;
  arabic: string;
}

/** A run of sentence text; `bold` marks the looked-up unit. */
export interface Segment {
  text: string;
  bold?: boolean;
}

export interface SavedItem {
  id: string;
  kind: CardKind;
  card: Card;
  selection: string;
  sentence: string;
  sentenceSegments: Segment[];
  pageTitle: string;
  url: string;
  savedAt: number;
}

export type ErrorCode =
  | 'no_key'
  | 'bad_key'
  | 'rate_limited'
  | 'overloaded'
  | 'timeout'
  | 'network'
  | 'invalid_answer'
  | 'refused'
  | 'bad_request'
  | 'too_long'
  | 'unknown';

export interface UserError {
  code: ErrorCode;
  message: string;
  status?: number;
}

export type LookupResponse =
  | { ok: true; card: Card; cached: boolean; id: string }
  | { ok: false; error: UserError };

export type SummaryResponse =
  | { ok: true; summary: Summary; cached: boolean }
  | { ok: false; error: UserError };

export interface Prefs {
  theme: 'dark' | 'light';
}

export const DEFAULT_PREFS: Prefs = { theme: 'dark' };
