import type { CardEntry } from './state';

/**
 * The card's header title. A sentence card is a translation, or an explanation when it is English
 * only. Before the answer arrives the card does not know which, so the title stays neutral.
 */
export function cardTitle(entry: CardEntry, showSummary: boolean): string {
  if (showSummary) return 'Article summary';
  const isWord = entry.kind === 'word';
  if (entry.status === 'loading') return isWord ? 'Looking up…' : 'Reading…';
  if (entry.status === 'error') return isWord ? entry.selection : 'Sentence';
  if (entry.card?.kind === 'word') return entry.card.headword;
  return entry.card?.language === 'none' ? 'Explanation' : 'Translation';
}
