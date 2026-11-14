import type { Card, CardKind, Segment, Summary, UserError } from '@/lib/types';

export interface PageRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface CardEntry {
  key: string;
  kind: CardKind;
  selection: string;
  status: 'loading' | 'ready' | 'error';
  card?: Card;
  /** Lookup id, used as the saved-item id. */
  id?: string;
  /** "provider:model" that answered. */
  model?: string;
  sentence?: string;
  sentenceSegments?: Segment[];
  error?: UserError;
  saved: boolean;
}

export interface SummaryState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  summary?: Summary;
  error?: UserError;
}

/**
 * True when a ready summary is in a different language from a card that has just arrived, which means
 * the reader changed the translation language while this page was open.
 */
export function summaryIsInAnotherLanguage(summary: SummaryState, cardLanguage: string): boolean {
  return summary.status === 'ready' && !!summary.summary && summary.summary.language.toLowerCase() !== cardLanguage.toLowerCase();
}

export interface CardState {
  theme: 'dark' | 'light';
  /** Trigger icon position in page coordinates, or null when hidden. */
  icon: { x: number; y: number } | null;
  card: { anchor: PageRect; stack: CardEntry[]; showSummary: boolean } | null;
  summary: SummaryState;
}

export interface CardActions {
  openFromIcon(): void;
  close(): void;
  back(): void;
  toggleSummary(): void;
  retry(): void;
  toggleSave(): void;
  openKeyExpression(index: number): void;
  openSettings(): void;
}

export const initialCardState = (): CardState => ({ theme: 'dark', icon: null, card: null, summary: { status: 'idle' } });
