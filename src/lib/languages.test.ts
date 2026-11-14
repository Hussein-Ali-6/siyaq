import { describe, expect, it } from 'vitest';
import {
  LANGUAGES,
  NO_TRANSLATION,
  hasScript,
  languageFromBrowser,
  languageLabel,
  languageName,
  otherLanguageId,
  otherLanguageName,
  resolveLanguage,
} from '@/lib/languages';

describe('LANGUAGES', () => {
  it('has 40 complete entries with unique ids, sorted by English name', () => {
    expect(LANGUAGES).toHaveLength(40);
    expect(new Set(LANGUAGES.map((l) => l.id.toLowerCase())).size).toBe(40);
    for (const l of LANGUAGES) {
      expect(l.nativeName.trim()).not.toBe('');
      expect(l.englishName.trim()).not.toBe('');
      expect(['ltr', 'rtl']).toContain(l.dir);
    }
    const names = LANGUAGES.map((l) => l.englishName);
    expect(names).toEqual([...names].sort());
  });

  it('names only real Unicode scripts', () => {
    for (const l of LANGUAGES) {
      if (l.script) expect(() => hasScript('x', l.script!)).not.toThrow();
    }
  });

  it('marks the right-to-left languages', () => {
    expect(LANGUAGES.filter((l) => l.dir === 'rtl').map((l) => l.id)).toEqual(['ar', 'he', 'fa', 'ur']);
  });
});

describe('resolveLanguage', () => {
  it('describes a listed language', () => {
    expect(resolveLanguage('ar')).toEqual({
      id: 'ar',
      label: 'العربية',
      promptName: 'Arabic',
      dir: 'rtl',
      lang: 'ar',
      script: 'Arabic',
      variety: 'Modern Standard Arabic',
    });
    expect(resolveLanguage('es')).toEqual({ id: 'es', label: 'Español', promptName: 'Spanish', dir: 'ltr', lang: 'es' });
    expect(resolveLanguage('PT-br').id).toBe('pt-BR');
  });

  it('treats a typed language and an unknown code as a name with automatic direction', () => {
    expect(resolveLanguage('x:Kurdish')).toEqual({ id: 'x:Kurdish', label: 'Kurdish', promptName: 'Kurdish', dir: 'auto' });
    expect(resolveLanguage('tlh')).toEqual({ id: 'tlh', label: 'tlh', promptName: 'tlh', dir: 'auto' });
  });
});

describe('typed languages', () => {
  it('builds an id from a cleaned name', () => {
    expect(otherLanguageId('  Kurdish \n (Sorani) ')).toBe('x:Kurdish (Sorani)');
    expect(otherLanguageId('a'.repeat(60))).toBe(`x:${'a'.repeat(40)}`);
    expect(otherLanguageId('Zulu‮')).toBe('x:Zulu');
  });

  it('returns null when nothing usable was typed', () => {
    expect(otherLanguageId('')).toBeNull();
    expect(otherLanguageId(' \n\t ')).toBeNull();
  });

  it('reads the name back', () => {
    expect(otherLanguageName('x:Kurdish')).toBe('Kurdish');
    expect(otherLanguageName('ar')).toBe('');
    expect(otherLanguageName(NO_TRANSLATION)).toBe('');
  });
});

describe('language names for people', () => {
  it('gives the English name, the typed name, or "English only"', () => {
    expect(languageName('zh-Hans')).toBe('Chinese (Simplified)');
    expect(languageName('x:Kurdish')).toBe('Kurdish');
    expect(languageName(NO_TRANSLATION)).toBe('English only');
  });

  it('gives the own name, the typed name, or "English only"', () => {
    expect(languageLabel('zh-Hans')).toBe('简体中文');
    expect(languageLabel('x:Kurdish')).toBe('Kurdish');
    expect(languageLabel(NO_TRANSLATION)).toBe('English only');
  });
});

describe('hasScript', () => {
  it('finds a character of any of the named scripts', () => {
    expect(hasScript('مرحبا', 'Arabic')).toBe(true);
    expect(hasScript('hello', 'Arabic')).toBe(false);
    expect(hasScript('こんにちは', 'Han|Hiragana|Katakana')).toBe(true);
    expect(hasScript('OK 好', 'Han')).toBe(true);
  });
});

describe('languageFromBrowser', () => {
  it.each([
    ['ar', 'ar'],
    ['ar-EG', 'ar'],
    ['es-419', 'es'],
    ['fr-CA', 'fr'],
    ['zh-TW', 'zh-Hant'],
    ['zh-HK', 'zh-Hant'],
    ['zh-Hant-TW', 'zh-Hant'],
    ['zh-CN', 'zh-Hans'],
    ['zh', 'zh-Hans'],
    ['pt-PT', 'pt-PT'],
    ['pt', 'pt-BR'],
    ['pt_BR', 'pt-BR'],
    ['no', 'nb'],
    ['nn-NO', 'nb'],
    ['tl', 'fil'],
    ['en', 'none'],
    ['en-GB', 'none'],
    ['xx-YY', 'none'],
    ['', 'none'],
  ])('%s gives %s', (uiLanguage, id) => {
    expect(languageFromBrowser(uiLanguage)).toBe(id);
  });
});
