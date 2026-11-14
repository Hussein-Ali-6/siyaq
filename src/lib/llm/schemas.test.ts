import { describe, expect, it } from 'vitest';
import { dictionarySchema, summarySchema, translationSchema } from '@/lib/llm/schemas';

const FORBIDDEN = ['enum', 'const', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern'];

function walk(node: unknown, visit: (obj: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>);
    Object.values(node).forEach((v) => walk(v, visit));
  }
}

const fieldsOf = (schema: unknown) => Object.keys((schema as { properties: object }).properties);

describe('API schemas', () => {
  it.each([
    ['dictionary', dictionarySchema('ar')],
    ['translation', translationSchema('ar')],
    ['summary', summarySchema('ar')],
    ['dictionary, English only', dictionarySchema('none')],
    ['translation, English only', translationSchema('none')],
    ['summary, English only', summarySchema('none')],
  ])('%s schema has no constraints and closed objects', (_name, schema) => {
    walk(schema, (obj) => {
      for (const key of FORBIDDEN) expect(obj).not.toHaveProperty(key);
      if (obj.type === 'object') {
        expect(obj.additionalProperties).toBe(false);
        expect(obj.required).toEqual(Object.keys(obj.properties as object));
      }
    });
  });

  it('has translation fields only when there is a language', () => {
    expect(fieldsOf(dictionarySchema('es'))).toEqual([
      'unitIndices', 'headword', 'partOfSpeech', 'ipaUk', 'ipaUs', 'meaning', 'translation', 'notes', 'sentenceTranslation', 'examples', 'combinations', 'otherMeanings',
    ]);
    expect(fieldsOf(dictionarySchema('none'))).toEqual([
      'unitIndices', 'headword', 'partOfSpeech', 'ipaUk', 'ipaUs', 'meaning', 'notes', 'examples', 'combinations', 'otherMeanings',
    ]);
    expect(fieldsOf(translationSchema('es'))).toEqual(['translation', 'plainEnglish', 'keyExpressions']);
    expect(fieldsOf(translationSchema('none'))).toEqual(['plainEnglish', 'keyExpressions']);
    expect(fieldsOf(summarySchema('es'))).toEqual(['english', 'translation']);
    expect(fieldsOf(summarySchema('none'))).toEqual(['english']);
  });

  it('gives every language the same schema object', () => {
    expect(dictionarySchema('es')).toBe(dictionarySchema('ja'));
  });
});
