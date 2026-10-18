import { browser } from 'wxt/browser';
import type { SavedItem } from '@/lib/types';

const KEY = 'saved';

async function readAll(): Promise<SavedItem[]> {
  const result = await browser.storage.local.get(KEY);
  const value = result[KEY];
  return Array.isArray(value) ? (value as SavedItem[]) : [];
}

/** Newest first. */
export async function listSaved(): Promise<SavedItem[]> {
  return (await readAll()).sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveItem(input: Omit<SavedItem, 'savedAt'>, now = Date.now()): Promise<SavedItem> {
  const item: SavedItem = { ...input, savedAt: now };
  const rest = (await readAll()).filter((i) => i.id !== input.id);
  await browser.storage.local.set({ [KEY]: [item, ...rest] });
  return item;
}

export async function removeSaved(id: string): Promise<void> {
  const rest = (await readAll()).filter((i) => i.id !== id);
  await browser.storage.local.set({ [KEY]: rest });
}

export async function isSaved(id: string): Promise<boolean> {
  return (await readAll()).some((i) => i.id === id);
}

/** Lowercases Latin text and folds Arabic diacritics and letter variants so searches are forgiving. */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function searchableText(item: SavedItem): string {
  const parts = [item.selection, item.sentence, item.pageTitle];
  if (item.card.kind === 'word') {
    const c = item.card;
    parts.push(c.headword, c.meaning, c.arabic, c.arabicMeaning ?? '', c.sentenceArabic, ...c.notes, ...c.combinations);
    parts.push(...c.otherMeanings.flatMap((m) => [m.meaning, m.arabic]));
  } else {
    const c = item.card;
    parts.push(c.arabic, c.plainEnglish);
    parts.push(...c.keyExpressions.flatMap((k) => [k.expression, k.meaning, k.arabic]));
  }
  return foldText(parts.join('\n'));
}

export function searchSaved(items: SavedItem[], query: string): SavedItem[] {
  const q = foldText(query.trim());
  if (!q) return items;
  return items.filter((item) => searchableText(item).includes(q));
}

export function toJson(items: SavedItem[]): string {
  return JSON.stringify(items, null, 2);
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const CSV_HEADER = ['kind', 'headword', 'arabic', 'arabic_meaning', 'meaning', 'sentence', 'translation', 'page', 'url', 'saved'];

export function toCsv(items: SavedItem[]): string {
  const rows = items.map((item) => {
    const saved = new Date(item.savedAt).toISOString().slice(0, 10);
    const cells =
      item.card.kind === 'word'
        ? ['word', item.card.headword, item.card.arabic, item.card.arabicMeaning ?? '', item.card.meaning, item.sentence, item.card.sentenceArabic]
        : ['sentence', '', '', '', item.card.plainEnglish, item.selection, item.card.arabic];
    return [...cells, item.pageTitle, item.url, saved].map(csvCell).join(',');
  });
  return [CSV_HEADER.join(','), ...rows].join('\n');
}
