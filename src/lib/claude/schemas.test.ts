import { describe, expect, it } from 'vitest';
import { DICTIONARY_SCHEMA, SUMMARY_SCHEMA, TRANSLATION_SCHEMA } from '@/lib/claude/schemas';

const FORBIDDEN = ['enum', 'const', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern'];

function walk(node: unknown, visit: (obj: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>);
    Object.values(node).forEach((v) => walk(v, visit));
  }
}

describe('API schemas', () => {
  it.each([
    ['dictionary', DICTIONARY_SCHEMA],
    ['translation', TRANSLATION_SCHEMA],
    ['summary', SUMMARY_SCHEMA],
  ])('%s schema has no constraints and closed objects', (_name, schema) => {
    walk(schema, (obj) => {
      for (const key of FORBIDDEN) expect(obj).not.toHaveProperty(key);
      if (obj.type === 'object') {
        expect(obj.additionalProperties).toBe(false);
        expect(obj.required).toEqual(Object.keys(obj.properties as object));
      }
    });
  });
});
