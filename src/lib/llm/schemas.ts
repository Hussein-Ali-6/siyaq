/**
 * Loose JSON schemas handed to the API's structured outputs. Deliberately without enums, minimums,
 * maximums or length limits: constrained decoding only guarantees the shape, and `validate.ts`
 * applies the strict rules afterwards so a bad answer triggers our own retry.
 */
import { NO_TRANSLATION } from '@/lib/languages';

export type JsonSchema = Record<string, unknown>;

const str: JsonSchema = { type: 'string' };
const strList: JsonSchema = { type: 'array', items: str };
const intList: JsonSchema = { type: 'array', items: { type: 'integer' } };

function object(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

function dictionary(translated: boolean): JsonSchema {
  return object({
    unitIndices: intList,
    headword: str,
    partOfSpeech: str,
    ipaUk: str,
    ipaUs: str,
    meaning: str,
    ...(translated ? { translation: str } : {}),
    notes: strList,
    ...(translated ? { sentenceTranslation: str } : {}),
    examples: strList,
    combinations: strList,
    otherMeanings: { type: 'array', items: object(translated ? { meaning: str, translation: str } : { meaning: str }) },
  });
}

function translation(translated: boolean): JsonSchema {
  return object({
    ...(translated ? { translation: str } : {}),
    plainEnglish: str,
    keyExpressions: {
      type: 'array',
      items: object({ expression: str, indices: intList, meaning: str, ...(translated ? { translation: str } : {}) }),
    },
  });
}

function summary(translated: boolean): JsonSchema {
  return object({ english: str, ...(translated ? { translation: str } : {}) });
}

// Built once: every language shares one shape, and English only has the other.
const SCHEMAS = {
  dictionary: { translated: dictionary(true), englishOnly: dictionary(false) },
  translation: { translated: translation(true), englishOnly: translation(false) },
  summary: { translated: summary(true), englishOnly: summary(false) },
};

const pick = (pair: { translated: JsonSchema; englishOnly: JsonSchema }, language: string): JsonSchema =>
  language === NO_TRANSLATION ? pair.englishOnly : pair.translated;

export const dictionarySchema = (language: string): JsonSchema => pick(SCHEMAS.dictionary, language);
export const translationSchema = (language: string): JsonSchema => pick(SCHEMAS.translation, language);
export const summarySchema = (language: string): JsonSchema => pick(SCHEMAS.summary, language);
