import { describe, expect, it } from 'vitest';
import { languageForOtherText, listChoice, optionLabel } from './ReadingSection';

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

describe('languageForOtherText', () => {
  it('stores what is typed: a typed language, or the listed one when the name is in the list', () => {
    expect(languageForOtherText('Kurdish', 'ar')).toBe('x:Kurdish');
    expect(languageForOtherText('K', 'ar')).toBe('x:K');
    expect(languageForOtherText('  arabic ', 'es')).toBe('ar');
    expect(languageForOtherText('English', 'es')).toBe('none');
  });

  it('goes back to the choice from before "Other…" was opened when the box is emptied', () => {
    expect(languageForOtherText('', 'ar')).toBe('ar');
    expect(languageForOtherText('   ', 'pt-BR')).toBe('pt-BR');
    expect(languageForOtherText('', 'none')).toBe('none');
  });

  it('goes to English only when the emptied box held the language that was chosen before', () => {
    expect(languageForOtherText('', 'x:Kurdish')).toBe('none');
    expect(languageForOtherText('', 'tlh')).toBe('none');
  });
});

describe('optionLabel', () => {
  it('shows the own name and the English name', () => {
    expect(optionLabel({ nativeName: 'العربية', englishName: 'Arabic' })).toBe('العربية · Arabic');
    expect(optionLabel({ nativeName: '简体中文', englishName: 'Chinese (Simplified)' })).toBe('简体中文 · Chinese (Simplified)');
  });

  it('shows the name once when both are the same', () => {
    expect(optionLabel({ nativeName: 'Filipino', englishName: 'Filipino' })).toBe('Filipino');
  });
});
