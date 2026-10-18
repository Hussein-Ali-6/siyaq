import { z } from 'zod';
import { validateIndices } from '@/lib/text/tokens';
import type { DictionaryCard, KeyExpression, Passage, Summary, TranslationCard } from '@/lib/types';

export const LIMITS = {
  notes: 2,
  examples: 2,
  combinations: 6,
  otherMeanings: 4,
  keyExpressions: 3,
} as const;

const ARABIC = /\p{Script=Arabic}/u;

const trimmed = z.string().transform((s) => s.trim());
const nonEmpty = trimmed.pipe(z.string().min(1));
const arabic = nonEmpty.refine((s) => ARABIC.test(s), { message: 'must contain Arabic script' });
const optionalString = trimmed.catch('');

/** A list of strings, blanks removed, trimmed to `max`. Anything that is not a list becomes empty. */
const stringList = (max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, max),
    );

const otherMeaningSchema = z.object({ meaning: nonEmpty, arabic });

const dictionarySchema = z.object({
  headword: nonEmpty,
  partOfSpeech: optionalString,
  unitIndices: z.unknown(),
  meaning: nonEmpty,
  arabic,
  notes: stringList(LIMITS.notes),
  sentenceArabic: arabic,
  examples: stringList(LIMITS.examples).refine((a) => a.length >= 1, { message: 'at least one example is required' }),
  combinations: stringList(LIMITS.combinations),
  otherMeanings: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .flatMap((x) => {
          const r = otherMeaningSchema.safeParse(x);
          return r.success ? [r.data] : [];
        })
        .slice(0, LIMITS.otherMeanings),
    ),
});

const keyExpressionSchema = z.object({ expression: nonEmpty, indices: z.unknown(), meaning: nonEmpty, arabic });

const translationSchema = z.object({
  arabic,
  plainEnglish: optionalString,
  keyExpressions: z.array(z.unknown()).catch([]),
});

const summarySchema = z.object({ english: nonEmpty, arabic });

export type Validation<T> = { ok: true; card: T } | { ok: false; reason: string };

function reasonOf(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || 'answer'}: ${i.message}`)
    .join('; ');
}

export function validateDictionary(raw: unknown, passage: Passage, selected: number[]): Validation<DictionaryCard> {
  const parsed = dictionarySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: reasonOf(parsed.error) };
  const indices = validateIndices(parsed.data.unitIndices, passage, selected);
  if (!indices.ok) return { ok: false, reason: `unitIndices: ${indices.reason}` };
  const { unitIndices: _ignored, ...rest } = parsed.data;
  // Phrasal verbs, idioms, fixed expressions and names never get "Common combinations".
  const combinations = /\s/.test(rest.headword) ? [] : rest.combinations;
  return { ok: true, card: { kind: 'word', ...rest, combinations, unitIndices: indices.indices } };
}

export function validateTranslation(raw: unknown, passage: Passage): Validation<TranslationCard> {
  const parsed = translationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: reasonOf(parsed.error) };
  const keyExpressions: KeyExpression[] = parsed.data.keyExpressions
    .flatMap((x): KeyExpression[] => {
      const r = keyExpressionSchema.safeParse(x);
      if (!r.success) return [];
      const idx = validateIndices(r.data.indices, passage, []);
      if (!idx.ok) return [];
      return [{ expression: r.data.expression, indices: idx.indices, meaning: r.data.meaning, arabic: r.data.arabic }];
    })
    .slice(0, LIMITS.keyExpressions);
  return {
    ok: true,
    card: { kind: 'sentence', arabic: parsed.data.arabic, plainEnglish: parsed.data.plainEnglish, keyExpressions },
  };
}

export function validateSummary(raw: unknown): Validation<Summary> {
  const parsed = summarySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: reasonOf(parsed.error) };
  return { ok: true, card: parsed.data };
}
