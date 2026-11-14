import { describe, expect, it } from 'vitest';
import { listChoice } from './ReadingSection';

describe('listChoice', () => {
  it('selects the matching entry for English only and for listed languages', () => {
    expect(listChoice('none')).toBe('none');
    expect(listChoice('ar')).toBe('ar');
    expect(listChoice('pt-BR')).toBe('pt-BR');
  });

  it('selects "Other…" for a typed language and for a code that is not in the list', () => {
    expect(listChoice('x:Kurdish')).toBe('other');
    expect(listChoice('tlh')).toBe('other');
  });
});
