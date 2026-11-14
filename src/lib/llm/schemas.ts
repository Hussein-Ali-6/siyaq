/**
 * Loose JSON schemas handed to the API's structured outputs. Deliberately without enums, minimums,
 * maximums or length limits: constrained decoding only guarantees the shape, and `validate.ts`
 * applies the strict rules afterwards so a bad answer triggers our own retry.
 */
export type JsonSchema = Record<string, unknown>;

const str: JsonSchema = { type: 'string' };
const strList: JsonSchema = { type: 'array', items: str };
const intList: JsonSchema = { type: 'array', items: { type: 'integer' } };

function object(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

export const DICTIONARY_SCHEMA: JsonSchema = object({
  unitIndices: intList,
  headword: str,
  partOfSpeech: str,
  ipaUk: str,
  ipaUs: str,
  meaning: str,
  translation: str,
  notes: strList,
  sentenceTranslation: str,
  examples: strList,
  combinations: strList,
  otherMeanings: { type: 'array', items: object({ meaning: str, translation: str }) },
});

export const TRANSLATION_SCHEMA: JsonSchema = object({
  translation: str,
  plainEnglish: str,
  keyExpressions: {
    type: 'array',
    items: object({ expression: str, indices: intList, meaning: str, translation: str }),
  },
});

export const SUMMARY_SCHEMA: JsonSchema = object({
  english: str,
  translation: str,
});
