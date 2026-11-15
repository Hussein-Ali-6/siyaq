import { z } from 'zod';
import { NO_TRANSLATION, hasScript, resolveLanguage, type ResolvedLanguage } from '@/lib/languages';
import { toFullWidthPunctuation } from '@/lib/text/punctuation';
import { validateIndices } from '@/lib/text/tokens';
import type { DictionaryCard, KeyExpression, OtherMeaning, Passage, Summary, TranslationCard } from '@/lib/types';

export const LIMITS = {
  examples: 2,
  combinations: 6,
  otherMeanings: 4,
  keyExpressions: 3,
} as const;

const trimmed = z.string().transform((s) => s.trim());
const nonEmpty = trimmed.pipe(z.string().min(1));
const optionalString = trimmed.catch('');
/** IPA without surrounding slashes or brackets; anything missing or implausibly long becomes empty. */
const ipa = z.unknown().optional().transform((v) => {
  if (typeof v !== 'string') return '';
  const s = v.trim().replace(/^[/[\s]+|[/\]\s]+$/g, '');
  return s.length > 80 ? '' : s;
});

/** A list of strings, blanks removed, trimmed to `max` when given. Anything that is not a list becomes empty. */
const stringList = (max = Infinity) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, max),
    );

const unknownList = z.array(z.unknown()).catch([]);

// The English parts of each answer. Translation fields are checked separately, by language.
const dictionaryFields = z.object({
  headword: nonEmpty,
  partOfSpeech: optionalString,
  ipaUk: ipa,
  ipaUs: ipa,
  unitIndices: z.unknown(),
  meaning: nonEmpty,
  // No cap on notes: the model decides how many are useful.
  notes: stringList(),
  examples: stringList(LIMITS.examples).refine((a) => a.length >= 1, { message: 'at least one example is required' }),
  combinations: stringList(LIMITS.combinations),
  otherMeanings: unknownList,
});
const otherMeaningFields = z.object({ meaning: nonEmpty });
const keyExpressionFields = z.object({ expression: nonEmpty, indices: z.unknown(), meaning: nonEmpty });
const translationFields = z.object({ plainEnglish: optionalString, keyExpressions: unknownList });
const summaryFields = z.object({ english: nonEmpty });

export type Validation<T> = { ok: true; card: T } | { ok: false; reason: string };
type Text = { ok: true; text: string } | { ok: false; reason: string };

function reasonOf(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || 'answer'}: ${i.message}`)
    .join('; ');
}

/** The language whose rules the translation fields follow. Null for English only, which has none. */
function translationLanguage(language: string): ResolvedLanguage | null {
  return language === NO_TRANSLATION ? null : resolveLanguage(language);
}

/**
 * One translation field: not empty, and when the language has its own script, containing at least
 * one character of it, which catches an answer left in English. Chinese gets its full-width
 * punctuation here, because asking for it in the prompt was not enough.
 */
function translationText(raw: unknown, field: string, lang: ResolvedLanguage): Text {
  const value = (raw as Record<string, unknown> | null)?.[field];
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return { ok: false, reason: `${field}: is required, in ${lang.promptName}` };
  if (lang.script && !hasScript(text, lang.script)) return { ok: false, reason: `${field}: must be written in ${lang.promptName}` };
  return { ok: true, text: lang.fullWidthPunctuation ? toFullWidthPunctuation(text) : text };
}

/** Other meanings whose English and translation are both usable; the rest are dropped. */
function otherMeanings(items: unknown[], lang: ResolvedLanguage | null): OtherMeaning[] {
  return items
    .flatMap((x): OtherMeaning[] => {
      const r = otherMeaningFields.safeParse(x);
      if (!r.success) return [];
      if (!lang) return [{ meaning: r.data.meaning }];
      const t = translationText(x, 'translation', lang);
      return t.ok ? [{ meaning: r.data.meaning, translation: t.text }] : [];
    })
    .slice(0, LIMITS.otherMeanings);
}

export function validateDictionary(raw: unknown, passage: Passage, selected: number[], language: string): Validation<DictionaryCard> {
  const parsed = dictionaryFields.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: reasonOf(parsed.error) };
  const indices = validateIndices(parsed.data.unitIndices, passage, selected);
  if (!indices.ok) return { ok: false, reason: `unitIndices: ${indices.reason}` };
  const { unitIndices: _ignored, otherMeanings: others, ...rest } = parsed.data;
  const lang = translationLanguage(language);
  const card = { kind: 'word' as const, language, ...rest, unitIndices: indices.indices, otherMeanings: otherMeanings(others, lang) };
  if (!lang) return { ok: true, card };
  const translation = translationText(raw, 'translation', lang);
  if (!translation.ok) return translation;
  const sentence = translationText(raw, 'sentenceTranslation', lang);
  if (!sentence.ok) return sentence;
  return { ok: true, card: { ...card, translation: translation.text, sentenceTranslation: sentence.text } };
}

export function validateTranslation(raw: unknown, passage: Passage, language: string): Validation<TranslationCard> {
  const parsed = translationFields.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: reasonOf(parsed.error) };
  const lang = translationLanguage(language);
  const keyExpressions = parsed.data.keyExpressions
    .flatMap((x): KeyExpression[] => {
      const r = keyExpressionFields.safeParse(x);
      if (!r.success) return [];
      const idx = validateIndices(r.data.indices, passage, []);
      if (!idx.ok) return [];
      const expression = { expression: r.data.expression, indices: idx.indices, meaning: r.data.meaning };
      if (!lang) return [expression];
      const t = translationText(x, 'translation', lang);
      return t.ok ? [{ ...expression, translation: t.text }] : [];
    })
    .slice(0, LIMITS.keyExpressions);
  const { plainEnglish } = parsed.data;
  if (!lang) {
    // With no translation, the plainer English is the explanation, so it is required.
    if (!plainEnglish) return { ok: false, reason: 'plainEnglish: is required' };
    return { ok: true, card: { kind: 'sentence', language, plainEnglish, keyExpressions } };
  }
  const translation = translationText(raw, 'translation', lang);
  if (!translation.ok) return translation;
  return { ok: true, card: { kind: 'sentence', language, translation: translation.text, plainEnglish, keyExpressions } };
}

export function validateSummary(raw: unknown, language: string): Validation<Summary> {
  const parsed = summaryFields.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: reasonOf(parsed.error) };
  const lang = translationLanguage(language);
  if (!lang) return { ok: true, card: { language, english: parsed.data.english } };
  const translation = translationText(raw, 'translation', lang);
  if (!translation.ok) return translation;
  return { ok: true, card: { language, english: parsed.data.english, translation: translation.text } };
}
