# Translation Language and Reading Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Siyaq work for any English learner: the translation language and the reading level become settings, and nothing in the code is fixed to Arabic.

**Architecture:** One module, `src/lib/languages.ts`, owns the language list. Cards, summaries and saved words carry a language id next to neutral `translation` fields. The background worker reads two new preferences and passes a `Reader` (language and level) to the prompt builders, the answer schemas, the validators and the cache keys. A one-time step on update converts saved words and keeps existing installs on Arabic and Advanced.

**Tech Stack:** TypeScript (strict), WXT (Chrome MV3), React 19, Tailwind v4, zod 4, vitest 5 (node environment, `wxt/testing` fake browser), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-13-language-setting-design.md`

**Not in this plan:** the Chrome Web Store materials (listing text, privacy documents, promo tile, screenshots). They get their own plan once this one is done, because the screenshot text comes from live output of the finished feature.

## Global Constraints

- Work on the branch `language-setting`. Do not push.
- Every task ends with `pnpm test`, `pnpm typecheck` and `pnpm build` all passing.
- Commit messages are one plain sentence. Never add a `Co-Authored-By` trailer, a "Generated with" line or any other tool attribution. Pass this rule on to any subagent that commits.
- A language id is one of: `none` (English only), a listed code such as `ar` or `pt-BR`, or `x:<name>` for a typed language.
- Levels are exactly `B1`, `B2` and `C1`. Their labels are "Intermediate (B1)", "Upper-intermediate (B2)" and "Advanced (C1)".
- `PROMPT_VERSION` becomes 13. The app version becomes 0.2.0.
- Siyaq's own labels and messages stay in English. Only English text is looked up.
- The name Siyaq and the س mark stay, so `font-arabic` on the trigger icon stays.
- Live model calls (`pnpm eval --live`) spend the user's API money. Ask the user and wait for a yes before each batch.
- Shell commands below use `\x27` for a single quote inside `perl -e '…'`.

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/lib/languages.ts` (new) | The language list and everything derived from a language id | 2 |
| `src/lib/types.ts` | Card, summary and preference shapes | 2, 3 |
| `src/lib/storage/migrate.ts` (new) | Converting old saved cards; the install and update step | 3, 5 |
| `src/lib/llm/validate.ts` | Checking a model answer for a language | 3 |
| `src/lib/llm/prompts.ts` | Prompt text for a reader (language and level) | 3, 4 |
| `src/lib/llm/schemas.ts` | Answer shapes with or without translation fields | 3, 4 |
| `src/lib/llm/lookup.ts`, `summary.ts` | Passing the reader through; cache keys | 3, 4, 5 |
| `src/lib/storage/cache.ts` | Summary cache keyed by URL and language | 5 |
| `src/lib/storage/saved.ts` | Saved words: conversion on read, search, export | 3, 8 |
| `src/entrypoints/background.ts` | Reads the preferences; runs the install and update step | 4, 5 |
| `src/ui/components/Translated.tsx` (new, replaces `Arabic.tsx`) | Text in the reader's language | 6 |
| `src/ui/card/title.ts` (new) | The card header title | 6 |
| `src/ui/card/*View.tsx`, popup, My words page | Showing or hiding translations | 3, 6, 8 |
| `src/entrypoints/options/ReadingSection.tsx` (new) | The Reading section of the settings page | 7 |
| `scripts/eval/run.ts` | `--language` and `--level` flags | 3, 4, 9 |
| `README.md`, `docs/PLAN.md`, `package.json`, `wxt.config.ts` | Docs, description, version | 11 |

---

### Task 1: Commit the store materials as they stand

The folders `store/`, `playground/store/` and `scripts/store/` are untracked. `playground/` is part of the type check, so Task 3 has to edit `playground/store/fixtures.ts`. Commit the folders first so later tasks change tracked files.

**Files:**
- Add: `store/` (4 Markdown files, 7 PNG images), `playground/store/` (7 files), `scripts/store/capture.sh`

- [ ] **Step 1: Check the tree is healthy**

Run: `pnpm typecheck && pnpm test`
Expected: the type check prints nothing and exits 0; vitest reports 23 files and 202 tests passed, none failed.

- [ ] **Step 2: Commit**

```bash
git add store playground/store scripts/store
git commit -m "Add the Chrome Web Store listing text, privacy documents and screenshot sources"
```

Expected: `git status --short` prints nothing.

---

### Task 2: Language list and the two preferences

**Files:**
- Create: `src/lib/languages.ts`
- Create: `src/lib/languages.test.ts`
- Modify: `src/lib/types.ts` (the `Prefs` block at the end of the file)
- Modify: `src/lib/storage/settings.test.ts` (the `describe('prefs', …)` block)

**Interfaces:**
- Consumes: nothing.
- Produces, from `@/lib/languages`:
  - `interface Language { id: string; nativeName: string; englishName: string; dir: 'ltr' | 'rtl'; script?: string; variety?: string }`
  - `const LANGUAGES: readonly Language[]` (40 entries, sorted by English name)
  - `const NO_TRANSLATION = 'none'`
  - `interface ResolvedLanguage { id: string; label: string; promptName: string; dir: 'ltr' | 'rtl' | 'auto'; lang?: string; script?: string; variety?: string }`
  - `resolveLanguage(id: string): ResolvedLanguage`
  - `otherLanguageId(name: string): string | null`, `otherLanguageName(id: string): string`
  - `languageName(id: string): string` (English name, typed name, or "English only")
  - `languageLabel(id: string): string` (own name, typed name, or "English only")
  - `hasScript(text: string, script: string): boolean`
  - `languageFromBrowser(uiLanguage: string): string`
- Produces, from `@/lib/types`: `type Level = 'B1' | 'B2' | 'C1'`; `Prefs` gains `language: string` and `level: Level`; `DEFAULT_PREFS = { theme: 'dark', language: 'none', level: 'B2' }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/languages.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm vitest run src/lib/languages.test.ts`
Expected: FAIL, because `@/lib/languages` does not exist.

- [ ] **Step 3: Write the module**

Create `src/lib/languages.ts`:

```ts
/**
 * The translation languages Siyaq offers, and the one place that knows about languages.
 *
 * A language id is stored wherever a language is recorded: "none" (English only), a listed code
 * such as "ar" or "pt-BR", or "x:<name>" for a language the reader typed, such as "x:Kurdish".
 */
export interface Language {
  /** BCP 47 code, also used as the HTML lang attribute. */
  id: string;
  nativeName: string;
  /** Also the name used in prompts. */
  englishName: string;
  dir: 'ltr' | 'rtl';
  /** Unicode script names, "|"-separated. Absent means translations get no script check. */
  script?: string;
  /** The written standard to ask the model for. */
  variety?: string;
}

export const NO_TRANSLATION = 'none';
const OTHER_PREFIX = 'x:';
const MAX_OTHER_NAME = 40;

/** Sorted by English name. */
export const LANGUAGES: readonly Language[] = [
  { id: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', script: 'Arabic', variety: 'Modern Standard Arabic' },
  { id: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', dir: 'ltr', script: 'Bengali' },
  { id: 'bg', nativeName: 'Български', englishName: 'Bulgarian', dir: 'ltr', script: 'Cyrillic' },
  { id: 'zh-Hans', nativeName: '简体中文', englishName: 'Chinese (Simplified)', dir: 'ltr', script: 'Han' },
  { id: 'zh-Hant', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', dir: 'ltr', script: 'Han' },
  { id: 'cs', nativeName: 'Čeština', englishName: 'Czech', dir: 'ltr' },
  { id: 'da', nativeName: 'Dansk', englishName: 'Danish', dir: 'ltr' },
  { id: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', dir: 'ltr' },
  { id: 'fil', nativeName: 'Filipino', englishName: 'Filipino', dir: 'ltr' },
  { id: 'fi', nativeName: 'Suomi', englishName: 'Finnish', dir: 'ltr' },
  { id: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { id: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { id: 'el', nativeName: 'Ελληνικά', englishName: 'Greek', dir: 'ltr', script: 'Greek' },
  { id: 'he', nativeName: 'עברית', englishName: 'Hebrew', dir: 'rtl', script: 'Hebrew' },
  { id: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', script: 'Devanagari' },
  { id: 'hu', nativeName: 'Magyar', englishName: 'Hungarian', dir: 'ltr' },
  { id: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr' },
  { id: 'it', nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr' },
  { id: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr', script: 'Han|Hiragana|Katakana' },
  { id: 'ko', nativeName: '한국어', englishName: 'Korean', dir: 'ltr', script: 'Hangul' },
  { id: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', dir: 'ltr' },
  { id: 'nb', nativeName: 'Norsk', englishName: 'Norwegian', dir: 'ltr' },
  { id: 'fa', nativeName: 'فارسی', englishName: 'Persian', dir: 'rtl', script: 'Arabic' },
  { id: 'pl', nativeName: 'Polski', englishName: 'Polish', dir: 'ltr' },
  { id: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', dir: 'ltr' },
  { id: 'pt-PT', nativeName: 'Português (Portugal)', englishName: 'Portuguese (Portugal)', dir: 'ltr' },
  { id: 'ro', nativeName: 'Română', englishName: 'Romanian', dir: 'ltr' },
  { id: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr', script: 'Cyrillic' },
  // Serbian is written in Cyrillic and in Latin, so it gets no script check.
  { id: 'sr', nativeName: 'Српски', englishName: 'Serbian', dir: 'ltr' },
  { id: 'sk', nativeName: 'Slovenčina', englishName: 'Slovak', dir: 'ltr' },
  { id: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { id: 'sw', nativeName: 'Kiswahili', englishName: 'Swahili', dir: 'ltr' },
  { id: 'sv', nativeName: 'Svenska', englishName: 'Swedish', dir: 'ltr' },
  { id: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', dir: 'ltr', script: 'Tamil' },
  { id: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', dir: 'ltr', script: 'Telugu' },
  { id: 'th', nativeName: 'ไทย', englishName: 'Thai', dir: 'ltr', script: 'Thai' },
  { id: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { id: 'uk', nativeName: 'Українська', englishName: 'Ukrainian', dir: 'ltr', script: 'Cyrillic' },
  { id: 'ur', nativeName: 'اردو', englishName: 'Urdu', dir: 'rtl', script: 'Arabic' },
  { id: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr' },
];

export interface ResolvedLanguage {
  id: string;
  /** The language's own name, or the typed name. */
  label: string;
  /** The English name used in prompts and exports, or the typed name. */
  promptName: string;
  dir: 'ltr' | 'rtl' | 'auto';
  /** HTML lang attribute. Absent for typed languages. */
  lang?: string;
  script?: string;
  variety?: string;
}

const byId = new Map(LANGUAGES.map((l) => [l.id.toLowerCase(), l]));

/** The typed name inside an "x:" id, or an empty string for any other id. */
export function otherLanguageName(id: string): string {
  return id.startsWith(OTHER_PREFIX) ? id.slice(OTHER_PREFIX.length) : '';
}

/** Builds the id for a language the reader typed. Null when nothing usable was typed. */
export function otherLanguageId(name: string): string | null {
  const clean = name.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_OTHER_NAME).trim();
  return clean ? OTHER_PREFIX + clean : null;
}

/** Details of a listed or typed language. Not meant for "none". An unknown code is treated as a typed name. */
export function resolveLanguage(id: string): ResolvedLanguage {
  const listed = byId.get(id.toLowerCase());
  if (listed) {
    return {
      id: listed.id,
      label: listed.nativeName,
      promptName: listed.englishName,
      dir: listed.dir,
      lang: listed.id,
      ...(listed.script ? { script: listed.script } : {}),
      ...(listed.variety ? { variety: listed.variety } : {}),
    };
  }
  const name = otherLanguageName(id) || id;
  return { id, label: name, promptName: name, dir: 'auto' };
}

/** For exports: the English name, the typed name, or "English only". */
export function languageName(id: string): string {
  return id === NO_TRANSLATION ? 'English only' : resolveLanguage(id).promptName;
}

/** For the reader: the language's own name, the typed name, or "English only". */
export function languageLabel(id: string): string {
  return id === NO_TRANSLATION ? 'English only' : resolveLanguage(id).label;
}

/** True when `text` has at least one character of the given scripts, such as "Han|Hiragana". */
export function hasScript(text: string, script: string): boolean {
  const pattern = script
    .split('|')
    .map((s) => `\\p{Script=${s}}`)
    .join('|');
  return new RegExp(pattern, 'u').test(text);
}

/** The language a new install starts with, from the browser's interface language. */
export function languageFromBrowser(uiLanguage: string): string {
  const tag = uiLanguage.trim().replace(/_/g, '-').toLowerCase();
  const base = tag.split('-')[0] ?? '';
  if (base === 'zh') return /-(tw|hk|hant)(-|$)/.test(tag) ? 'zh-Hant' : 'zh-Hans';
  if (base === 'pt') return tag === 'pt-pt' ? 'pt-PT' : 'pt-BR';
  if (base === 'no' || base === 'nn') return 'nb';
  if (base === 'tl') return 'fil';
  return byId.get(tag)?.id ?? byId.get(base)?.id ?? NO_TRANSLATION;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run src/lib/languages.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Update the preferences test**

In `src/lib/storage/settings.test.ts`, replace the whole `describe('prefs', …)` block with:

```ts
describe('prefs', () => {
  it('defaults to dark, English only and B2, and merges partial updates', async () => {
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'none', level: 'B2' });
    expect(await setPrefs({ theme: 'light' })).toEqual({ theme: 'light', language: 'none', level: 'B2' });
    expect(await setPrefs({ language: 'es', level: 'C1' })).toEqual({ theme: 'light', language: 'es', level: 'C1' });
    expect(await getPrefs()).toEqual({ theme: 'light', language: 'es', level: 'C1' });
  });
});
```

Run: `pnpm vitest run src/lib/storage/settings.test.ts`
Expected: FAIL in this test (`language` and `level` are missing).

- [ ] **Step 6: Add the preferences**

In `src/lib/types.ts`, replace the last two declarations (`export interface Prefs { … }` and `export const DEFAULT_PREFS …`) with:

```ts
/** CEFR reading level the explanations are written for. */
export type Level = 'B1' | 'B2' | 'C1';

export interface Prefs {
  theme: 'dark' | 'light';
  /** Translation language id from `@/lib/languages`: "none", a listed code, or "x:<name>". */
  language: string;
  level: Level;
}

/** Only the fallback for a read that happens before the install step has stored real values. */
export const DEFAULT_PREFS: Prefs = { theme: 'dark', language: 'none', level: 'B2' };
```

Nothing reads the two new preferences yet, so lookups do not change.

- [ ] **Step 7: Run everything**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all tests pass, the type check exits 0, the build finishes.

- [ ] **Step 8: Commit**

```bash
git add src/lib/languages.ts src/lib/languages.test.ts src/lib/types.ts src/lib/storage/settings.test.ts
git commit -m "Add the translation language list and the language and level preferences"
```

---

### Task 3: Name card translations by language, validate by language, convert saved words

This is the widest task. The data shape changes everywhere at once so the tree compiles at the end. Arabic stays the only language in use: `lookup.ts` and `summary.ts` pass `'ar'` until Task 4.

**Files:**
- Create: `src/lib/storage/migrate.ts`, `src/lib/storage/migrate.test.ts`
- Modify: `src/lib/types.ts` (from `OtherMeaning` to `Summary`)
- Rewrite: `src/lib/llm/validate.ts`
- Modify: `src/lib/llm/validate.test.ts`, `src/lib/llm/schemas.ts`, `src/lib/llm/prompts.ts`, `src/lib/llm/prompts.test.ts`, `src/lib/llm/lookup.ts`, `src/lib/llm/lookup.test.ts`, `src/lib/llm/summary.ts`, `src/lib/llm/summary.test.ts`
- Modify: `src/lib/storage/saved.ts`, `src/lib/storage/saved.test.ts`, `src/lib/storage/cache.test.ts`
- Modify: `src/ui/card/DictionaryView.tsx`, `src/ui/card/TranslationView.tsx`, `src/ui/card/SummaryView.tsx`, `src/entrypoints/popup/App.tsx`, `src/entrypoints/words/App.tsx`
- Modify: `playground/main.tsx`, `playground/store/fixtures.ts`, `scripts/eval/run.ts`

**Interfaces:**
- Consumes: `NO_TRANSLATION`, `hasScript`, `resolveLanguage`, `ResolvedLanguage` from `@/lib/languages` (Task 2).
- Produces:
  - Card fields: `translation?`, `sentenceTranslation?`, `translationNote?` and a required `language: string` on `DictionaryCard`, `TranslationCard` and `Summary`; `translation?` on `OtherMeaning` and `KeyExpression`.
  - `validateDictionary(raw: unknown, passage: Passage, selected: number[], language: string): Validation<DictionaryCard>`
  - `validateTranslation(raw: unknown, passage: Passage, language: string): Validation<TranslationCard>`
  - `validateSummary(raw: unknown, language: string): Validation<Summary>`
  - `migrateCard(card: Card): Card` and `migrateSavedItem(item: SavedItem): SavedItem` from `@/lib/storage/migrate`
  - The model's JSON uses `translation` and `sentenceTranslation`. `PROMPT_VERSION` is 13.

- [ ] **Step 1: Write the failing conversion test**

Create `src/lib/storage/migrate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { migrateCard, migrateSavedItem } from '@/lib/storage/migrate';
import type { Card, SavedItem } from '@/lib/types';

/** Cards as they were stored before translations had a language. */
const oldWord = {
  kind: 'word',
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  ipaUk: 'ˌtɜːn ˈdaʊn',
  ipaUs: 'ˌtɝːn ˈdaʊn',
  unitIndices: [3, 6],
  meaning: 'to refuse an offer',
  arabic: 'رفض',
  arabicMeaning: 'لم يقبل عرضًا',
  notes: ['Informal.'],
  sentenceArabic: 'رفضوا العرض.',
  examples: ['She turned down the job.'],
  combinations: ['turn down an offer'],
  otherMeanings: [{ meaning: 'to reduce the volume', arabic: 'خفّض' }],
} as unknown as Card;

const oldSentence = {
  kind: 'sentence',
  arabic: 'فشلت الصفقة.',
  plainEnglish: '',
  keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'failed', arabic: 'فشل' }],
} as unknown as Card;

const oldItem = {
  id: 'a',
  kind: 'word',
  card: oldWord,
  selection: 'turned',
  sentence: 'They turned the offer down.',
  sentenceSegments: [{ text: 'They turned the offer down.' }],
  pageTitle: 'Page',
  url: 'https://example.com/p',
  savedAt: 5,
} as SavedItem;

describe('migrateCard', () => {
  it('renames the fields of an old word card and marks it Arabic', () => {
    expect(migrateCard(oldWord)).toEqual({
      kind: 'word',
      language: 'ar',
      headword: 'turn down',
      partOfSpeech: 'phrasal verb',
      ipaUk: 'ˌtɜːn ˈdaʊn',
      ipaUs: 'ˌtɝːn ˈdaʊn',
      unitIndices: [3, 6],
      meaning: 'to refuse an offer',
      translation: 'رفض',
      translationNote: 'لم يقبل عرضًا',
      notes: ['Informal.'],
      sentenceTranslation: 'رفضوا العرض.',
      examples: ['She turned down the job.'],
      combinations: ['turn down an offer'],
      otherMeanings: [{ meaning: 'to reduce the volume', translation: 'خفّض' }],
    });
  });

  it('leaves out the note when the old card had none', () => {
    const { arabicMeaning: _note, ...withoutNote } = oldWord as unknown as Record<string, unknown>;
    expect(migrateCard(withoutNote as unknown as Card)).not.toHaveProperty('translationNote');
  });

  it('renames the fields of an old sentence card', () => {
    expect(migrateCard(oldSentence)).toEqual({
      kind: 'sentence',
      language: 'ar',
      translation: 'فشلت الصفقة.',
      plainEnglish: '',
      keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'failed', translation: 'فشل' }],
    });
  });

  it('returns a card that already has a language unchanged', () => {
    const once = migrateCard(oldWord);
    expect(migrateCard(once)).toBe(once);
  });
});

describe('migrateSavedItem', () => {
  it('converts the card and keeps the rest', () => {
    const next = migrateSavedItem(oldItem);
    expect(next.card).toEqual(migrateCard(oldWord));
    expect({ ...next, card: null }).toEqual({ ...oldItem, card: null });
  });

  it('returns an item that is already converted unchanged', () => {
    const once = migrateSavedItem(oldItem);
    expect(migrateSavedItem(once)).toBe(once);
  });
});
```

Run: `pnpm vitest run src/lib/storage/migrate.test.ts`
Expected: FAIL, because `@/lib/storage/migrate` does not exist.

- [ ] **Step 2: Write the conversion**

Create `src/lib/storage/migrate.ts`:

```ts
import type { Card, SavedItem } from '@/lib/types';

type Fields = Record<string, unknown>;

const list = (value: unknown): Fields[] => (Array.isArray(value) ? (value as Fields[]) : []);

/**
 * Converts a card stored before translations had a language, when Arabic was the only one. A card
 * that already has a language is returned as it is, so converting twice is safe.
 */
export function migrateCard(card: Card): Card {
  const old = card as unknown as Fields;
  if (typeof old.language === 'string') return card;
  if (old.kind === 'word') {
    const { arabic, arabicMeaning, sentenceArabic, otherMeanings, ...rest } = old;
    return {
      ...rest,
      language: 'ar',
      translation: arabic,
      ...(arabicMeaning ? { translationNote: arabicMeaning } : {}),
      sentenceTranslation: sentenceArabic,
      otherMeanings: list(otherMeanings).map(({ arabic: a, ...m }) => ({ ...m, translation: a })),
    } as unknown as Card;
  }
  const { arabic, keyExpressions, ...rest } = old;
  return {
    ...rest,
    language: 'ar',
    translation: arabic,
    keyExpressions: list(keyExpressions).map(({ arabic: a, ...k }) => ({ ...k, translation: a })),
  } as unknown as Card;
}

export function migrateSavedItem(item: SavedItem): SavedItem {
  const card = migrateCard(item.card);
  return card === item.card ? item : { ...item, card };
}
```

Run: `pnpm vitest run src/lib/storage/migrate.test.ts`
Expected: PASS.

- [ ] **Step 3: Change the card types**

In `src/lib/types.ts`, replace everything from `export interface OtherMeaning {` down to the closing brace of `export interface Summary { … }` with:

```ts
export interface OtherMeaning {
  meaning: string;
  /** Absent on English-only cards. */
  translation?: string;
}

export interface DictionaryCard {
  kind: 'word';
  /** Language id of the translations (`@/lib/languages`); "none" when the card is English only. */
  language: string;
  headword: string;
  partOfSpeech: string;
  /** British and American IPA without slashes; empty when unknown, missing on cards saved before 2026-10-18. */
  ipaUk?: string;
  ipaUs?: string;
  /** Indices of the unit's words in the passage, verified against the request. */
  unitIndices: number[];
  meaning: string;
  /** This sense in the reader's language, with a short clarification when a single word would mislead. */
  translation?: string;
  /** Only on cards saved while the explanation was a separate field; shown and searched for those. */
  translationNote?: string;
  notes: string[];
  /** The sentence in the reader's language. */
  sentenceTranslation?: string;
  examples: string[];
  combinations: string[];
  otherMeanings: OtherMeaning[];
}

export interface KeyExpression {
  expression: string;
  indices: number[];
  meaning: string;
  /** Absent on English-only cards. */
  translation?: string;
}

export interface TranslationCard {
  kind: 'sentence';
  /** Language id of the translations (`@/lib/languages`); "none" when the card is English only. */
  language: string;
  /** The selection in the reader's language. Absent on English-only cards. */
  translation?: string;
  /** Empty when the original is easy to follow. Always given on English-only cards. */
  plainEnglish: string;
  keyExpressions: KeyExpression[];
}

export type Card = DictionaryCard | TranslationCard;

export interface Summary {
  /** Language id of the translation (`@/lib/languages`); "none" when the summary is English only. */
  language: string;
  english: string;
  translation?: string;
}
```

- [ ] **Step 4: Rename the fields in code, tests and fixtures**

Run these four commands from the repository root:

```bash
perl -pi -e 's/\bsentenceArabic\b/sentenceTranslation/g; s/\barabicMeaning\b/translationNote/g; s/\barabic:/translation:/g; s/\.arabic\b/.translation/g; s/\{ \.\.\.good, arabic \}/{ ...good, translation: arabic }/' src/lib/llm/validate.test.ts src/lib/llm/lookup.test.ts src/lib/llm/summary.test.ts src/lib/llm/prompts.test.ts src/lib/storage/cache.test.ts src/ui/card/DictionaryView.tsx src/ui/card/TranslationView.tsx src/ui/card/SummaryView.tsx src/entrypoints/popup/App.tsx src/entrypoints/words/App.tsx playground/main.tsx playground/store/fixtures.ts scripts/eval/run.ts
```

```bash
perl -pi -e 's/^  kind: \x27(word|sentence)\x27,$/  kind: \x27$1\x27,\n  language: \x27ar\x27,/; s/^(export const summary: Summary|const summaryText) = \{$/$1 = {\n  language: \x27ar\x27,/' playground/main.tsx playground/store/fixtures.ts
```

```bash
perl -pi -e 's/kind: \x27sentence\x27, translation:/kind: \x27sentence\x27, language: \x27ar\x27, translation:/; s/\{ english: /{ language: \x27ar\x27, english: /g' src/lib/storage/cache.test.ts src/lib/llm/prompts.test.ts
```

```bash
perl -pi -e 's/"sentenceArabic":/"sentenceTranslation":/g; s/"arabic":/"translation":/g; s/^- sentenceArabic:/- sentenceTranslation:/; s/^- arabic:/- translation:/; s/same approach as the arabic field/same approach as the translation field/; s/and arabic \(the usual equivalent/and translation (the usual Arabic equivalent/; s/^export const PROMPT_VERSION = 12;/export const PROMPT_VERSION = 13;/; s/\bsentenceArabic: str\b/sentenceTranslation: str/; s/\barabic: str\b/translation: str/g' src/lib/llm/prompts.ts src/lib/llm/schemas.ts
```

What they do:
- The first renames `arabic`, `sentenceArabic` and `arabicMeaning` where they are object keys or property reads.
- The second adds `language: 'ar'` to the card and summary fixtures in the playground.
- The third adds `language: 'ar'` to the typed card and summary literals in two tests.
- The fourth renames the fields in the model's JSON (prompt rules, worked examples, schemas) and raises the prompt version.

The prompts still ask for Arabic. Task 4 rewrites them.

- [ ] **Step 5: Update the validation tests**

In `src/lib/llm/validate.test.ts`, replace the import of `validateDictionary, validateSummary, validateTranslation` (the third line of the file) with:

```ts
import * as validate from '@/lib/llm/validate';
import type { Passage } from '@/lib/types';

// The older tests below check Arabic, the language Siyaq started with.
const validateDictionary = (raw: unknown, p: Passage, selected: number[], language = 'ar') => validate.validateDictionary(raw, p, selected, language);
const validateTranslation = (raw: unknown, p: Passage, language = 'ar') => validate.validateTranslation(raw, p, language);
const validateSummary = (raw: unknown, language = 'ar') => validate.validateSummary(raw, language);
```

Append to the end of the same file:

```ts
describe('translation language rules', () => {
  const spanish = {
    ...good,
    translation: 'rechazar',
    sentenceTranslation: 'Rechazaron la oferta.',
    otherMeanings: [{ meaning: 'To reduce the volume.', translation: 'bajar' }],
  };

  it('records the language on every result', () => {
    const d = validateDictionary(good, passage, [3]);
    const t = validateTranslation(tGood, tPassage);
    const s = validateSummary({ english: 'A summary.', translation: 'ملخص.' });
    expect(d.ok && d.card.language).toBe('ar');
    expect(t.ok && t.card.language).toBe('ar');
    expect(s.ok && s.card.language).toBe('ar');
  });

  it('accepts Latin-script languages without a script check, but not empty text', () => {
    expect(validateDictionary(spanish, passage, [3], 'es').ok).toBe(true);
    expect(validateDictionary({ ...spanish, translation: ' ' }, passage, [3], 'es').ok).toBe(false);
    const { sentenceTranslation: _s, ...missing } = spanish;
    expect(validateDictionary(missing, passage, [3], 'es').ok).toBe(false);
  });

  it('checks the script of languages that have their own', () => {
    expect(validateSummary({ english: 'A summary.', translation: '要約です。' }, 'ja').ok).toBe(true);
    expect(validateSummary({ english: 'A summary.', translation: 'A summary.' }, 'ja').ok).toBe(false);
    expect(validateSummary({ english: 'A summary.', translation: 'خلاصه.' }, 'fa').ok).toBe(true);
    expect(validateSummary({ english: 'A summary.', translation: 'Краткое содержание.' }, 'ar').ok).toBe(false);
  });

  it('says which language a rejected field must be in', () => {
    const r = validateSummary({ english: 'A summary.', translation: 'A summary.' }, 'ko');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('translation: must be written in Korean');
  });

  it('only asks a typed language for non-empty text', () => {
    expect(validateSummary({ english: 'A summary.', translation: 'Kurteyek.' }, 'x:Kurdish').ok).toBe(true);
    expect(validateSummary({ english: 'A summary.', translation: '' }, 'x:Kurdish').ok).toBe(false);
  });
});

describe('English only', () => {
  it('leaves translation fields out of a word card, even when the model sent them', () => {
    const r = validateDictionary(good, passage, [3], 'none');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card.language).toBe('none');
      expect(r.card).not.toHaveProperty('translation');
      expect(r.card).not.toHaveProperty('sentenceTranslation');
      expect(r.card.otherMeanings).toEqual([{ meaning: 'To reduce the volume or power of something.' }]);
    }
  });

  it('accepts a word card that has no translation fields', () => {
    const { translation: _t, sentenceTranslation: _s, ...bare } = good;
    expect(validateDictionary({ ...bare, otherMeanings: [{ meaning: 'Another sense.' }] }, passage, [3], 'none').ok).toBe(true);
  });

  it('requires the plainer English of a sentence card and drops translations', () => {
    expect(validateTranslation(tGood, tPassage, 'none').ok).toBe(false);
    const r = validateTranslation({ ...tGood, plainEnglish: 'The deal failed at the last moment.' }, tPassage, 'none');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.card).not.toHaveProperty('translation');
      expect(r.card.keyExpressions).toEqual([{ expression: 'fell through', indices: [3, 4], meaning: 'To fail to happen.' }]);
    }
  });

  it('keeps only the English summary', () => {
    expect(validateSummary({ english: 'A summary.', translation: 'ملخص.' }, 'none')).toEqual({
      ok: true,
      card: { language: 'none', english: 'A summary.' },
    });
  });
});
```

Run: `pnpm vitest run src/lib/llm/validate.test.ts`
Expected: FAIL. The validators still read `arabic` and take no language.

- [ ] **Step 6: Rewrite the validators**

Replace the whole of `src/lib/llm/validate.ts` with:

```ts
import { z } from 'zod';
import { NO_TRANSLATION, hasScript, resolveLanguage, type ResolvedLanguage } from '@/lib/languages';
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
 * one character of it, which catches an answer left in English.
 */
function translationText(raw: unknown, field: string, lang: ResolvedLanguage): Text {
  const value = (raw as Record<string, unknown> | null)?.[field];
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return { ok: false, reason: `${field}: is required, in ${lang.promptName}` };
  if (lang.script && !hasScript(text, lang.script)) return { ok: false, reason: `${field}: must be written in ${lang.promptName}` };
  return { ok: true, text };
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
```

Run: `pnpm vitest run src/lib/llm/validate.test.ts`
Expected: PASS.

- [ ] **Step 7: Pass Arabic from the two callers**

In `src/lib/llm/lookup.ts`, replace the `const validated = …` statement with:

```ts
    // Arabic stays fixed here until the reader's language is passed in (next task).
    const validated = isWord
      ? validateDictionary(json, req.passage, req.selectedIndices, 'ar')
      : validateTranslation(json, req.passage, 'ar');
```

In `src/lib/llm/summary.ts`, replace `const validated = validateSummary(json);` with:

```ts
    // Arabic stays fixed here until the reader's language is passed in (next task).
    const validated = validateSummary(json, 'ar');
```

- [ ] **Step 8: Convert saved words when they are read**

In `src/lib/storage/saved.test.ts`, run:

```bash
perl -pi -e 's/^      arabic,$/      translation: arabic,/; s/\barabicMeaning:/translationNote:/; s/\bsentenceArabic:/sentenceTranslation:/; s/^      kind: \x27word\x27,$/      kind: \x27word\x27,\n      language: \x27ar\x27,/; s/kind: \x27sentence\x27, arabic:/kind: \x27sentence\x27, language: \x27ar\x27, translation:/' src/lib/storage/saved.test.ts
```

Then append to the end of `src/lib/storage/saved.test.ts`:

```ts
describe('items saved before translations had a language', () => {
  it('are converted when read', async () => {
    const old = {
      id: 'old',
      kind: 'sentence',
      card: { kind: 'sentence', arabic: 'مرحبا', plainEnglish: '', keyExpressions: [] },
      selection: 'Hello',
      sentence: 'Hello',
      sentenceSegments: [{ text: 'Hello' }],
      pageTitle: 'P',
      url: 'https://example.com/o',
      savedAt: 1,
    };
    await fakeBrowser.storage.local.set({ saved: [old] });
    const [item] = await listSaved();
    expect(item?.card).toEqual({ kind: 'sentence', language: 'ar', translation: 'مرحبا', plainEnglish: '', keyExpressions: [] });
    expect(await isSaved('old')).toBe(true);
  });
});
```

In `src/lib/storage/saved.ts`:

1. Add the import below the existing ones:

```ts
import { migrateSavedItem } from '@/lib/storage/migrate';
```

2. Replace `readAll` with:

```ts
async function readAll(): Promise<SavedItem[]> {
  const result = await browser.storage.local.get(KEY);
  const value = result[KEY];
  // Items saved before translations had a language are converted on the way in.
  return Array.isArray(value) ? (value as SavedItem[]).map(migrateSavedItem) : [];
}
```

3. Replace `searchableText` with:

```ts
function searchableText(item: SavedItem): string {
  const parts: Array<string | undefined> = [item.selection, item.sentence, item.pageTitle];
  if (item.card.kind === 'word') {
    const c = item.card;
    parts.push(c.headword, c.meaning, c.translation, c.translationNote, c.sentenceTranslation, ...c.notes, ...c.combinations);
    parts.push(...c.otherMeanings.flatMap((m) => [m.meaning, m.translation]));
  } else {
    const c = item.card;
    parts.push(c.translation, c.plainEnglish);
    parts.push(...c.keyExpressions.flatMap((k) => [k.expression, k.meaning, k.translation]));
  }
  return foldText(parts.filter(Boolean).join('\n'));
}
```

4. Replace the `arabicText` function and its comment with:

```ts
/** The card's translation, plus the separate explanation that a few older saved cards carry. */
function translationText(card: DictionaryCard): string {
  return [card.translation, card.translationNote].filter(Boolean).join(' — ');
}
```

5. In `toCsv`, replace the two `cells` lines with (the header changes in Task 8):

```ts
        ? ['word', item.card.headword, item.card.ipaUk ?? '', item.card.ipaUs ?? '', translationText(item.card), item.card.meaning, item.sentence, item.card.sentenceTranslation ?? '']
        : ['sentence', '', '', '', '', item.card.plainEnglish, item.selection, item.card.translation ?? ''];
```

- [ ] **Step 9: Fix the two optional reads in the evaluation script**

In `scripts/eval/run.ts`:

- In `flags`, replace the line that starts `if (words(card.translation) > 25)` (it reports "Arabic is long") with:

```ts
    if (words(card.translation ?? '') > 25) out.push(`translation is long (${words(card.translation ?? '')} words)`);
```

- In the summary block, replace `res.summary.translation, ''` at the end of the `report.push(...)` call with `res.summary.translation ?? '', ''`.

- [ ] **Step 10: Check nothing still uses the old names**

Run:

```bash
grep -rnE "\barabic(Meaning)?\b|sentenceArabic" src playground scripts --include="*.ts" --include="*.tsx" | grep -v "scripts/eval/out/" | grep -v "storage/migrate"
```

Expected: only these remain.
- The local variable `arabic` in `validate.test.ts` and the parameter `arabic` in `saved.test.ts`.
- The word inside test names and strings: `'accepts english and arabic text'` and `'not arabic'`.
- The `arabic` column in `CSV_HEADER` (`saved.ts`) and in the header its test expects. Task 8 renames it.
- The CSS class `arabic` in `src/ui/components/Arabic.tsx` and `src/ui/card/DictionaryView.tsx`, and `font-arabic` in `TriggerIcon.tsx` (Task 6 handles the class; the icon stays).

- [ ] **Step 11: Run everything**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all tests pass, the type check exits 0, the build finishes. If the type check names a line that still reads an optional translation as a `string`, add `?? ''` there.

- [ ] **Step 12: Commit**

```bash
git add -A src playground scripts
git commit -m "Name card translations by language instead of Arabic, and convert saved words"
```

---

### Task 4: Prompts and answer formats for the reader's language and level

**Files:**
- Modify: `src/lib/llm/prompts.ts` (everything above `pageContextBlock`, plus one label)
- Modify: `src/lib/llm/prompts.test.ts` (imports and the first `describe`)
- Rewrite: `src/lib/llm/schemas.ts`, `src/lib/llm/schemas.test.ts`
- Modify: `src/lib/llm/lookup.ts`, `src/lib/llm/lookup.test.ts`, `src/lib/llm/summary.ts`, `src/lib/llm/summary.test.ts`
- Modify: `src/entrypoints/background.ts`, `scripts/eval/run.ts` (both pass Arabic and Advanced for now)

**Interfaces:**
- Consumes: `NO_TRANSLATION`, `resolveLanguage` (Task 2); `Level` (Task 2); the validators with a language parameter (Task 3).
- Produces:
  - From `@/lib/llm/prompts`: `interface Reader { language: string; level: Level }`, `dictionarySystem(reader: Reader): string`, `translationSystem(reader: Reader): string`, `summarySystem(language: string): string`. The constants `DICTIONARY_SYSTEM`, `TRANSLATION_SYSTEM` and `SUMMARY_SYSTEM` are gone.
  - From `@/lib/llm/schemas`: `dictionarySchema(language: string): JsonSchema`, `translationSchema(language: string): JsonSchema`, `summarySchema(language: string): JsonSchema`. The three `*_SCHEMA` constants are gone.
  - `LookupDeps` gains `reader: Reader`. `SummaryDeps` gains `language: string`.

- [ ] **Step 1: Write the failing prompt tests**

In `src/lib/llm/prompts.test.ts`, replace the import from `@/lib/llm/prompts` with:

```ts
import {
  dictionarySystem,
  dictionaryUserMessage,
  pageContextBlock,
  summarySystem,
  summaryUserMessage,
  translationSystem,
  translationUserMessage,
  type Reader,
} from '@/lib/llm/prompts';
```

Replace the whole `describe('system prompts', …)` block with:

```ts
const arabicC1: Reader = { language: 'ar', level: 'C1' };
const spanishB2: Reader = { language: 'es', level: 'B2' };

describe('system prompts', () => {
  it('are long enough to be cached and contain worked examples with empty lists', () => {
    const dictionary = dictionarySystem(arabicC1);
    expect(dictionary.length).toBeGreaterThan(3000);
    expect(dictionary).toContain('"notes": []');
    expect(dictionary).toContain('"ipaUk"');
    expect(dictionary).toContain('"ipaUs"');
    expect(dictionary).toContain('"combinations": []');
    expect(translationSystem(arabicC1)).toContain('"keyExpressions": []');
    expect(translationSystem(arabicC1)).toContain('"plainEnglish": ""');
    expect(summarySystem('ar').length).toBeGreaterThan(200);
  });

  it('describe the reader from the settings', () => {
    expect(dictionarySystem(spanishB2)).toContain('a native speaker of Spanish who reads English at about B2 level');
    expect(translationSystem({ language: 'x:Kurdish', level: 'B1' })).toContain('a native speaker of Kurdish who reads English at about B1 level');
    expect(dictionarySystem({ language: 'none', level: 'C1' })).toContain('wants explanations in English only');
  });

  it('name the language in the field rules and ask for its written standard', () => {
    expect(dictionarySystem(spanishB2)).toContain('- translation: the Spanish for this sense');
    expect(dictionarySystem(spanishB2)).toContain('- sentenceTranslation: a natural Spanish translation');
    expect(translationSystem(arabicC1)).toContain('in Modern Standard Arabic');
    expect(translationSystem({ language: 'es', level: 'C1' })).not.toContain('Modern Standard');
    expect(summarySystem('ar')).toContain('natural Modern Standard Arabic');
    expect(summarySystem('ja')).toContain('natural Japanese');
  });

  it('contain no Arabic text and no fixed language', () => {
    const all = [dictionarySystem(spanishB2), translationSystem(spanishB2), summarySystem('es')].join('\n');
    expect(all).not.toMatch(/\p{Script=Arabic}/u);
    expect(all).not.toContain('Arabic');
  });

  it('say after the examples that the translation fields are still required', () => {
    expect(dictionarySystem(spanishB2)).toContain('Your answer must include them, written in Spanish');
    expect(translationSystem(spanishB2)).toContain('Your answer must include them, written in Spanish');
  });

  it('leave translation fields out for English only and always ask for plainer English', () => {
    const dictionary = dictionarySystem({ language: 'none', level: 'B2' });
    const sentence = translationSystem({ language: 'none', level: 'B2' });
    for (const text of [dictionary, sentence, summarySystem('none')]) {
      expect(text).not.toContain('translation:');
      expect(text).not.toContain('sentenceTranslation');
      expect(text).not.toContain('Your answer must include them');
    }
    expect(sentence).toContain('Always give it');
    expect(sentence).not.toContain('"plainEnglish": ""');
  });

  it('keep the original wording for an advanced reader', () => {
    expect(dictionarySystem(arabicC1)).toContain('Most cards have none.');
    expect(dictionarySystem(arabicC1)).toContain('Basic grammar a C1 reader already knows, word history and background facts are not notes');
    expect(translationSystem(arabicC1)).toContain('that a C1 reader could plausibly misread');
    expect(translationSystem(arabicC1)).toContain('Leave it empty when the selection is clear.');
  });

  it('explain more for lower levels', () => {
    expect(translationSystem({ language: 'es', level: 'B1' })).toContain('Always give it');
    expect(translationSystem({ language: 'es', level: 'B1' })).toContain('a B1 reader may not know');
    expect(translationSystem(spanishB2)).toContain('a B2 reader may not know');
    expect(dictionarySystem({ language: 'es', level: 'B1' })).toContain('very common words');
    expect(dictionarySystem({ language: 'es', level: 'B1' })).not.toContain('C1 reader');
  });

  it('return the same text for the same settings', () => {
    expect(dictionarySystem({ language: 'fa', level: 'B1' })).toBe(dictionarySystem({ language: 'fa', level: 'B1' }));
  });
});
```

Run: `pnpm vitest run src/lib/llm/prompts.test.ts`
Expected: FAIL, because `dictionarySystem` is not exported.

- [ ] **Step 2: Rewrite the system prompts**

In `src/lib/llm/prompts.ts`, replace everything above `export function pageContextBlock` (the imports, `PROMPT_VERSION` and the three `*_SYSTEM` constants) with:

```ts
import { NO_TRANSLATION, resolveLanguage } from '@/lib/languages';
import { buildNumberedPassage } from '@/lib/text/tokens';
import { normalizeWhitespace } from '@/lib/text/words';
import type { Level, LookupRequest, PageContext, Summary } from '@/lib/types';

/** Bump when a prompt changes so cached answers made with the old prompt are not reused. */
export const PROMPT_VERSION = 13;

/** Who the answer is for: the translation language id (`@/lib/languages`) and the reading level. */
export interface Reader {
  language: string;
  level: Level;
}

/** What changes with the reading level. Advanced (C1) keeps the wording the prompts started with. */
interface LevelGuide {
  /** Added to the meaning rule. */
  meaning: string;
  /** Added to the examples rule. */
  examples: string;
  /** How often a card has notes. */
  notesOften: string;
  /** Extra reasons for a note. */
  notesAlso: string[];
  /** What is not worth a note. */
  notesLimit: string;
  /** Which expressions of a selection to explain. */
  keyExpressions: string;
  /** True when the plainer English of a selection is always given. */
  alwaysPlain: boolean;
}

const LEVELS: Record<Level, LevelGuide> = {
  B1: {
    meaning: ' Use only very common words and one short sentence, as a dictionary for intermediate learners does.',
    examples: ' Keep them short and use common words.',
    notesOften: 'Many cards have none.',
    notesAlso: [
      'a word the reader could easily confuse with this one;',
      'how the word is normally used, such as the preposition or verb pattern that goes with it;',
    ],
    notesLimit: 'Word history and background facts are not notes, and neither is anything the meaning already says. Write notes in very simple English.',
    keyExpressions:
      'up to three idioms, phrasal verbs or less common words from the selection that a B1 reader may not know. Choose the ones that matter most for understanding the selection.',
    alwaysPlain: true,
  },
  B2: {
    meaning: ' Define it with words a B2 reader knows, never with a harder word.',
    examples: '',
    notesOften: 'Many cards have none.',
    notesAlso: [
      'a word the reader could easily confuse with this one;',
      'a register a B2 reader may not expect, such as formal or old-fashioned;',
    ],
    notesLimit: 'Grammar a B2 reader already knows, word history and background facts are not notes, and neither is anything the meaning already says.',
    keyExpressions:
      "up to three idioms, phrasal verbs, unusual terms or tricky phrases from the selection that a B2 reader may not know or could misread. Words they already know don't need explaining, so some selections have none.",
    alwaysPlain: false,
  },
  C1: {
    meaning: '',
    examples: '',
    notesOften: 'Most cards have none.',
    notesAlso: [],
    notesLimit: 'Basic grammar a C1 reader already knows, word history and background facts are not notes, and neither is anything the meaning already says.',
    keyExpressions:
      "up to three idioms, unusual terms or tricky phrases from the selection that a C1 reader could plausibly misread. Common words and phrasal verbs they already know don't need explaining, so many selections have none.",
    alwaysPlain: false,
  },
};

function describeReader(reader: Reader): string {
  if (reader.language === NO_TRANSLATION) {
    return `a reader who reads English at about ${reader.level} level and wants explanations in English only`;
  }
  return `a native speaker of ${resolveLanguage(reader.language).promptName} who reads English at about ${reader.level} level`;
}

// The worked examples show the English fields only, so they are the same for every language.
const DICTIONARY_EXAMPLES = `Numbered passage: "[1]The [2]board [3]met [4]on [5]Monday. [6]After [7]a [8]short [9]debate [10]it [11]turned [12]the [13]offer [14]down. [15]Nobody [16]was [17]surprised."
Selected: [11]turned
{
  "unitIndices": [11, 14],
  "headword": "turn down",
  "partOfSpeech": "phrasal verb",
  "ipaUk": "ˌtɜːn ˈdaʊn",
  "ipaUs": "ˌtɝːn ˈdaʊn",
  "meaning": "to refuse an offer, request or proposal",
  "notes": [],
  "examples": ["She turned down the job because the salary was too low.", "They turned our request down without any explanation."],
  "combinations": [],
  "otherMeanings": [{"meaning": "to reduce the sound, heat or power of a machine"}]
}

Numbered passage: "[1]The [2]forecast [3]warned [4]of [5]heavy [6]rain. [7]Most [8]people [9]decided [10]to [11]stay [12]home. [13]The [14]streets [15]were [16]empty."
Selected: [9]decided
{
  "unitIndices": [9],
  "headword": "decide",
  "partOfSpeech": "verb",
  "ipaUk": "dɪˈsaɪd",
  "ipaUs": "dɪˈsaɪd",
  "meaning": "to choose what to do after thinking about it",
  "notes": [],
  "examples": ["We decided to leave early to avoid the traffic.", "I still haven't decided which course to take."],
  "combinations": [],
  "otherMeanings": []
}

Numbered passage: "[1]Nobody [2]expected [3]much [4]from [5]the [6]small [7]club. [8]As [9]the [10]underdog, [11]it [12]had [13]nothing [14]to [15]lose. [16]It [17]won [18]the [19]cup."
Selected: [10]underdog
{
  "unitIndices": [10],
  "headword": "underdog",
  "partOfSpeech": "noun",
  "ipaUk": "ˈʌndədɒɡ",
  "ipaUs": "ˈʌndərdɔːɡ",
  "meaning": "a person or team that is expected to lose a competition or fight",
  "notes": [],
  "examples": ["Everyone loves to cheer for the underdog.", "The young lawyer was the underdog in the election."],
  "combinations": [],
  "otherMeanings": []
}

Numbered passage: "[1]He [2]promised [3]to [4]keep [5]the [6]plan [7]secret. [8]By [9]Friday [10]he [11]had [12]spilled [13]the [14]beans [15]to [16]half [17]the [18]office."
Selected: [14]beans
{
  "unitIndices": [12, 13, 14],
  "headword": "spill the beans",
  "partOfSpeech": "idiom",
  "ipaUk": "ˌspɪl ðə ˈbiːnz",
  "ipaUs": "ˌspɪl ðə ˈbiːnz",
  "meaning": "to tell people a secret, often by accident",
  "notes": ["Informal. The image is of beans spilling out of a container that should have stayed closed."],
  "examples": ["Don't spill the beans about the party; it's a surprise.", "Who spilled the beans to the press?"],
  "combinations": [],
  "otherMeanings": []
}

Numbered passage: "[1]The [2]company [3]promised [4]record [5]sales. [6]Few [7]analysts [8]believed [9]the [10]forecast. [11]Its [12]shares [13]fell."
Selected: [6]Few
{
  "unitIndices": [6],
  "headword": "few",
  "partOfSpeech": "determiner",
  "ipaUk": "fjuː",
  "ipaUs": "fjuː",
  "meaning": "a small number of people or things, often fewer than expected",
  "notes": ["Without \"a\", few stresses how small the number is, so the sentence means most analysts did not believe the forecast; \"a few\" would sound more positive."],
  "examples": ["Few people remember his first film.", "There are few places left where you can camp for free."],
  "combinations": [],
  "otherMeanings": []
}`;

export function dictionarySystem(reader: Reader): string {
  const guide = LEVELS[reader.level];
  const lang = reader.language === NO_TRANSLATION ? null : resolveLanguage(reader.language);
  const name = lang?.promptName ?? '';
  const alreadySaid = lang ? 'the meaning, translation, examples and other meanings' : 'the meaning, examples and other meanings';
  const noteReasons = [
    "a figurative use whose link to the basic meaning isn't obvious;",
    'the image or story behind an idiom;',
    'a person or reference they need to follow the sentence;',
    'an unexpected tone, such as informal, literary or offensive;',
    'grammar that changes how this sentence should be read, such as an unusual structure or a word working as another part of speech;',
    ...guide.notesAlso,
    'a likely misreading.',
  ];
  const fields = [
    `- unitIndices: the indices of the words that make up the unit the reader means. Often that is just the selected word. It can also be a phrasal verb, idiom, fixed expression, compound or name that the word belongs to, even when its parts are split ("turned the offer down" is turned + down). Prefer the smallest unit a dictionary would list as its own entry: a word together with the noun or adjective next to it is only a unit when the two form a fixed expression ("armed militias" is militia, "a modicum of" is modicum). Include at least one selected index.`,
    `- headword: the dictionary form of the unit, such as "turn down", "decision" or "spill the beans".`,
    `- partOfSpeech: a short label such as noun, verb, phrasal verb, idiom or proper noun.`,
    `- ipaUk and ipaUs: the British and American pronunciation of the headword in IPA, as a learner's dictionary such as Oxford shows it, with stress marks and without slashes. For a phrase, give the whole phrase; for a name, its usual English pronunciation.`,
    `- meaning: a short, clear explanation in simple English of the sense used here, written like a learner's dictionary entry so it would also fit other sentences with this sense. Explain the word rather than retelling the sentence.${guide.meaning}`,
    ...(lang
      ? [
          `- translation: the ${name} for this sense. Often the usual equivalent word or phrase is enough. When a single ${name} word would mislead, for example because it has several meanings and only some match, or because no ${name} word fits this sense, add a few words of clarification or give a short explanation instead. Keep it brief.`,
        ]
      : []),
    `- notes: "Good to know" notes. ${guide.notesOften} Add a note only when it tells this reader something they need for this sentence that ${alreadySaid} don't already say. There is no fixed number: write as many as are genuinely useful, and keep each one short. Good reasons include:\n${noteReasons.map((r) => `  - ${r}`).join('\n')}\n  ${guide.notesLimit} If you are unsure, leave it out. Pronunciation has its own fields, so notes don't need to cover it.`,
    ...(lang
      ? [
          `- sentenceTranslation: a natural ${name} translation of the sentence that contains the selection, as a skilled ${name} writer would put it, rendering idioms by their meaning.`,
        ]
      : []),
    `- examples: two short, natural example sentences that use the unit in the same sense, in everyday situations different from the article.${guide.examples}`,
    `- combinations: common partners worth learning together with the word, such as "make a decision" or "heavy rain", when it has strong ones.`,
    lang
      ? `- otherMeanings: other common senses of the headword, each with a short English meaning and its ${name} translation, following the same approach as the translation field. Empty when the word essentially has one sense.`
      : `- otherMeanings: other common senses of the headword, each with a short English meaning. Empty when the word essentially has one sense.`,
  ];
  const afterExamples = lang
    ? `\n\nThe examples leave out translation, sentenceTranslation and the translation inside otherMeanings to keep them short. Your answer must include them, written in ${name}.`
    : '';
  return `You are Siyaq, a context-aware English dictionary for one reader: ${describeReader(reader)}. While reading an article in Chrome, they selected a word or short phrase and want to understand what it means here, in this sentence.

## What you receive
- The page title and site, and a summary of the article when one exists.
- The paragraph around the selection.
- A numbered passage: the sentence with the selection plus one sentence before and after, with every word prefixed by its index, like [12]gave [13]up. Punctuation is not numbered.
- The indices of the words the reader selected.

## What to return
A JSON object with the fields below. Use an empty string or an empty list when a field has nothing useful to add.

${fields.join('\n')}

## Examples

${DICTIONARY_EXAMPLES}${afterExamples}`;
}

/** Worked examples for a selection. When plainer English is always given, the simple ones show it too. */
function translationExamples(alwaysPlain: boolean): string {
  const museum = alwaysPlain ? 'The museum opens at nine, and you do not have to pay to go in on Sundays.' : '';
  const deal = alwaysPlain ? 'The deal failed at the last moment, and the investors got nothing from it.' : '';
  return `Numbered passage: "[1]The [2]museum [3]opens [4]at [5]nine [6]and [7]admission [8]is [9]free [10]on [11]Sundays."
{
  "plainEnglish": ${JSON.stringify(museum)},
  "keyExpressions": []
}

Numbered passage: "[1]The [2]deal [3]fell [4]through [5]at [6]the [7]last [8]minute, [9]and [10]the [11]investors [12]walked [13]away [14]with [15]nothing."
{
  "plainEnglish": ${JSON.stringify(deal)},
  "keyExpressions": [
    {"expression": "fell through", "indices": [3, 4], "meaning": "failed to happen after being planned"}
  ]
}

Numbered passage: "[1]Notwithstanding [2]the [3]foregoing, [4]the [5]licensee [6]shall [7]indemnify [8]the [9]licensor [10]against [11]any [12]claims [13]by [14]others [15]arising [16]from [17]its [18]use [19]of [20]the [21]software."
{
  "plainEnglish": "Even so, the person using the software must cover the owner's costs if someone else makes a claim because of that use.",
  "keyExpressions": [
    {"expression": "notwithstanding the foregoing", "indices": [1, 2, 3], "meaning": "despite what was said before"},
    {"expression": "indemnify", "indices": [7], "meaning": "to promise to pay for any loss or damage someone suffers"}
  ]
}`;
}

export function translationSystem(reader: Reader): string {
  const guide = LEVELS[reader.level];
  const lang = reader.language === NO_TRANSLATION ? null : resolveLanguage(reader.language);
  const name = lang?.promptName ?? '';
  // With no translation, the plainer English is the explanation, so it is always given.
  const alwaysPlain = guide.alwaysPlain || !lang;
  const keyExpressionParts = lang
    ? `Each has expression (as it appears in the text), indices (the indices of its words in the numbered passage), meaning (short, simple English) and translation (the usual ${name} equivalent, with a few words of clarification only when a single word would mislead).`
    : 'Each has expression (as it appears in the text), indices (the indices of its words in the numbered passage) and meaning (short, simple English).';
  const fields = [
    ...(lang
      ? [
          `- translation: a natural, fluent ${name} translation of the whole selection, as a skilled ${name} writer would express the same meaning: idiomatic rather than word for word${lang.variety ? `, in ${lang.variety}` : ''}, keeping the writer's tone and any paragraph breaks.`,
        ]
      : []),
    alwaysPlain
      ? '- plainEnglish: a plainer English restatement of the whole selection in one or two short sentences, using common words. Always give it.'
      : '- plainEnglish: a plainer English restatement in one or two sentences when the original is hard to follow, for example dense, ironic, technical or tangled. Leave it empty when the selection is clear.',
    `- keyExpressions: ${guide.keyExpressions} ${keyExpressionParts}`,
  ];
  const afterExamples = lang
    ? `\n\nThe examples leave out translation, for the selection and inside keyExpressions, to keep them short. Your answer must include them, written in ${name}.`
    : '';
  return `You are Siyaq, ${lang ? 'a translator' : 'a reading helper'} for one reader: ${describeReader(reader)}. While reading an article in Chrome, they selected a sentence or a longer passage and want to understand it as the writer meant it.

## What you receive
- The page title and site, and a summary of the article when one exists.
- The paragraph around the selection, for context.
- The selection itself as a numbered passage, with every word prefixed by its index, like [12]gave [13]up. Punctuation is not numbered.

## What to return
A JSON object with these fields:

${fields.join('\n')}

## Examples

${translationExamples(alwaysPlain)}${afterExamples}`;
}

/** The summary does not depend on the reading level: its English is plain enough for all three. */
export function summarySystem(language: string): string {
  const english =
    '- english: a summary of 100 to 150 words, staying under 150, in simple, clear English (B1 to B2), in one or two short paragraphs. Cover what the article is about, its main points and its conclusion or argument, without adding opinions of your own.';
  const notAnArticle = 'If the text is not really an article, such as a list of links or a login page, describe what is there in a sentence or two instead.';
  if (language === NO_TRANSLATION) {
    return `You write article summaries for people who are learning English.

Return a JSON object with one field:
${english}

${notAnArticle}`;
  }
  const lang = resolveLanguage(language);
  return `You write article summaries for a native speaker of ${lang.promptName} who is learning English.

Return a JSON object with two fields:
${english}
- translation: the same summary in natural ${lang.variety ?? lang.promptName}, as a skilled ${lang.promptName} writer would put it.

${notAnArticle}`;
}
```

Then, further down in `translationUserMessage`, replace the line `'Selection to translate, as a numbered passage:',` with:

```ts
    'The selection, as a numbered passage:',
```

Run: `pnpm vitest run src/lib/llm/prompts.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing schema tests**

Replace the whole of `src/lib/llm/schemas.test.ts` with:

```ts
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
```

Run: `pnpm vitest run src/lib/llm/schemas.test.ts`
Expected: FAIL, because `dictionarySchema` is not exported.

- [ ] **Step 4: Rewrite the schemas**

Replace the whole of `src/lib/llm/schemas.ts` with:

```ts
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
```

Run: `pnpm vitest run src/lib/llm/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing lookup and summary tests**

In `src/lib/llm/lookup.test.ts`:

1. Add this import below the others:

```ts
import type { Reader } from '@/lib/llm/prompts';
```

2. Replace the whole `fakeDeps` function with:

```ts
function fakeDeps(
  answers: Array<unknown | Error>,
  reader: Reader = { language: 'ar', level: 'C1' },
): LookupDeps & { calls: number; store: Map<string, Card>; systems: string[] } {
  const store = new Map<string, Card>();
  const deps = {
    calls: 0,
    store,
    systems: [] as string[],
    client: {
      async callStructured(args: { system: string }) {
        deps.systems.push(args.system);
        const next = answers[deps.calls++];
        if (next instanceof Error) throw next;
        return { json: next, stopReason: 'end_turn' };
      },
      async ping() {},
    },
    cache: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, card: Card) => {
        store.set(key, card);
      },
    },
    getSummary: async () => null,
    reader,
    retryDelayMs: 0,
    modelId: 'anthropic:claude-sonnet-5-5',
  };
  return deps;
}
```

3. Add these two tests inside `describe('performLookup', …)`:

```ts
  it('asks for the reader\'s language and level and records the language on the card', async () => {
    const spanish = { ...goodAnswer, translation: 'rechazar', sentenceTranslation: 'Rechazaron la oferta.' };
    const deps = fakeDeps([spanish], { language: 'es', level: 'B2' });
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok && res.card.language).toBe('es');
    expect(deps.systems[0]).toContain('a native speaker of Spanish who reads English at about B2 level');
  });

  it('accepts an answer without translations when the reader chose English only', async () => {
    const { translation: _t, sentenceTranslation: _s, ...bare } = goodAnswer;
    const deps = fakeDeps([bare], { language: 'none', level: 'B2' });
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok && res.card.language).toBe('none');
  });
```

In `src/lib/llm/summary.test.ts`:

1. Change the first line of `fakeDeps` to take the language, and add it to the returned object:

```ts
function fakeDeps(answers: unknown[], delayMs = 0, language = 'ar'): SummaryDeps & { calls: number; store: Map<string, Summary> } {
```

and, next to `retryDelayMs: 0,`:

```ts
    language,
```

2. Add this test inside `describe('performSummary', …)`:

```ts
  it('writes an English-only summary when the reader chose no translation', async () => {
    const deps = fakeDeps([{ english: 'A short summary.' }], 0, 'none');
    const res = await performSummary({ ...input, url: 'https://example.com/e' }, deps);
    expect(res.ok && res.summary).toEqual({ language: 'none', english: 'A short summary.' });
  });
```

Run: `pnpm vitest run src/lib/llm/lookup.test.ts src/lib/llm/summary.test.ts`
Expected: FAIL in the three new tests (and the type check would reject `reader` and `language`).

- [ ] **Step 6: Pass the reader through lookups and summaries**

In `src/lib/llm/lookup.ts`:

1. Replace the imports from `@/lib/llm/prompts` and `@/lib/llm/schemas` with:

```ts
import {
  PROMPT_VERSION,
  dictionarySystem,
  dictionaryUserMessage,
  pageContextBlock,
  translationSystem,
  translationUserMessage,
  type Reader,
} from '@/lib/llm/prompts';
import { dictionarySchema, translationSchema } from '@/lib/llm/schemas';
```

2. In `LookupDeps`, add above `modelId`:

```ts
  /** Who the answer is for: translation language and reading level. */
  reader: Reader;
```

3. In `performLookup`, replace the `system` and `schema` lines with:

```ts
  const { reader } = deps;
  const system = isWord ? dictionarySystem(reader) : translationSystem(reader);
  const schema = isWord ? dictionarySchema(reader.language) : translationSchema(reader.language);
```

4. Replace the `const validated = …` statement and the comment above it (added in Task 3) with:

```ts
    const validated = isWord
      ? validateDictionary(json, req.passage, req.selectedIndices, reader.language)
      : validateTranslation(json, req.passage, reader.language);
```

In `src/lib/llm/summary.ts`:

1. Replace the imports from `@/lib/llm/prompts` and `@/lib/llm/schemas` with:

```ts
import { pageContextBlock, summarySystem, summaryUserMessage } from '@/lib/llm/prompts';
import { summarySchema } from '@/lib/llm/schemas';
```

2. In `SummaryDeps`, add:

```ts
  /** Translation language id; "none" for an English-only summary. */
  language: string;
```

3. In `summarize`, replace `system: SUMMARY_SYSTEM,` with `system: summarySystem(deps.language),` and `schema: SUMMARY_SCHEMA,` with `schema: summarySchema(deps.language),`.

4. Replace the `const validated = …` line and the comment above it (added in Task 3) with:

```ts
    const validated = validateSummary(json, deps.language);
```

- [ ] **Step 7: Keep the app on Arabic and Advanced for one more task**

In `src/entrypoints/background.ts`:

1. Add the import:

```ts
import type { Reader } from '@/lib/llm/prompts';
```

2. Directly below `const summaryCache = …`, add:

```ts
  // Arabic and Advanced until the next task reads the reader's settings.
  const reader: Reader = { language: 'ar', level: 'C1' };
```

3. In the `lookup` handler, add `reader,` to the object passed to `performLookup` (after `modelId: r.modelId,`).

4. In the `summarize` handler, change the call to:

```ts
    return performSummary(data, { client: r.client, cache: summaryCache, language: reader.language });
```

In `scripts/eval/run.ts`:

1. Add the import:

```ts
import type { Reader } from '@/lib/llm/prompts';
```

2. Below the line `const withSummary = …`, add:

```ts
const reader: Reader = { language: 'ar', level: 'C1' };
```

3. In the `performSummary` call, add `language: reader.language,` to the second argument (after `client,`).

4. In the `performLookup` call, add `reader,` to the second argument (after `modelId,`).

- [ ] **Step 8: Run everything**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all tests pass, the type check exits 0, the build finishes.

Run: `grep -rn "DICTIONARY_SYSTEM\|TRANSLATION_SYSTEM\|SUMMARY_SYSTEM\|_SCHEMA\b" src scripts --include="*.ts" --include="*.tsx" | grep -v "scripts/eval/out/"`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add -A src scripts
git commit -m "Write the prompts and answer formats for the reader's language and level"
```

---

### Task 5: Read the settings, key the caches by them, and prepare storage on install and update

After this task the feature works end to end: changing the two preferences in storage changes what lookups return.

**Files:**
- Modify: `src/lib/llm/lookup.ts`, `src/lib/llm/lookup.test.ts`
- Modify: `src/lib/llm/summary.ts`, `src/lib/llm/summary.test.ts`
- Modify: `src/lib/storage/cache.ts`, `src/lib/storage/cache.test.ts`
- Modify: `src/lib/storage/migrate.ts`, `src/lib/storage/migrate.test.ts`
- Modify: `src/entrypoints/background.ts`

**Interfaces:**
- Consumes: `Reader` (Task 4); `languageFromBrowser` (Task 2); `migrateSavedItem` (Task 3); `clearCaches` from `@/lib/storage/cache`; `setPrefs` from `@/lib/storage/settings`.
- Produces:
  - `cacheKeyFor(req: LookupRequest, modelId: string, reader: Reader): Promise<string>`
  - `LookupDeps.getSummary(url: string, language: string): Promise<Summary | null>`
  - `SummaryCache.get(url: string, language: string)` and `SummaryCache.set(url: string, language: string, summary: Summary)`
  - `getCachedSummary(url: string, language: string)` and `setCachedSummary(url: string, language: string, summary: Summary, at?: number)`
  - `prepareStorage(reason: string, uiLanguage: string): Promise<void>` from `@/lib/storage/migrate`

- [ ] **Step 1: Write the failing tests**

In `src/lib/llm/lookup.test.ts`, replace the whole `describe('cacheKeyFor', …)` block with:

```ts
const arabicC1: Reader = { language: 'ar', level: 'C1' };

describe('cacheKeyFor', () => {
  it('differs between models so one model never reuses another model\'s answer', async () => {
    const req = wordRequest();
    expect(await cacheKeyFor(req, 'anthropic:claude-sonnet-5-5', arabicC1)).not.toBe(await cacheKeyFor(req, 'openai:gpt-x', arabicC1));
    expect(await cacheKeyFor(req, 'openai:gpt-x', arabicC1)).toBe(await cacheKeyFor(req, 'openai:gpt-x', arabicC1));
  });

  it('differs between languages and levels, ignoring the case of the language id', async () => {
    const req = wordRequest();
    const model = 'openai:gpt-x';
    const base = await cacheKeyFor(req, model, arabicC1);
    expect(await cacheKeyFor(req, model, { language: 'es', level: 'C1' })).not.toBe(base);
    expect(await cacheKeyFor(req, model, { language: 'ar', level: 'B1' })).not.toBe(base);
    expect(await cacheKeyFor(req, model, { language: 'x:Kurdish', level: 'B2' })).toBe(await cacheKeyFor(req, model, { language: 'x:kurdish', level: 'B2' }));
  });
});
```

Add this test inside `describe('performLookup', …)`:

```ts
  it('does not reuse a cached card after the language changes', async () => {
    const spanish = { ...goodAnswer, translation: 'rechazar', sentenceTranslation: 'Rechazaron la oferta.' };
    const deps = fakeDeps([goodAnswer, spanish]);
    await performLookup(wordRequest(), deps);
    deps.reader = { language: 'es', level: 'C1' };
    const res = await performLookup(wordRequest(), deps);
    expect(res.ok && res.cached).toBe(false);
    expect(deps.calls).toBe(2);
  });
```

In `src/lib/llm/summary.test.ts`, replace the `cache: { … }` object inside `fakeDeps` with:

```ts
    cache: {
      get: async (url: string, lang: string) => store.get(`${url}|${lang}`) ?? null,
      set: async (url: string, lang: string, s: Summary) => {
        store.set(`${url}|${lang}`, s);
      },
    },
```

and add this test inside `describe('performSummary', …)`:

```ts
  it('keeps one summary per language', async () => {
    const page = { ...input, url: 'https://example.com/d' };
    const deps = fakeDeps([good, { english: 'A short summary.', translation: 'Un resumen corto.' }]);
    await performSummary(page, deps);
    deps.language = 'es';
    const res = await performSummary(page, deps);
    expect(res.ok && res.cached).toBe(false);
    expect(res.ok && res.summary.language).toBe('es');
    expect(deps.calls).toBe(2);
    expect(deps.store.size).toBe(2);
  });
```

In `src/lib/storage/cache.test.ts`, replace the whole `describe('summary cache', …)` block with:

```ts
describe('summary cache', () => {
  it('is keyed by the normalised URL and the language', async () => {
    const summary = { language: 'ar', english: 'Gist.', translation: 'الخلاصة.' };
    await setCachedSummary('https://example.com/a?utm_source=x#top', 'ar', summary);
    expect(await getCachedSummary('https://example.com/a', 'ar')).toEqual(summary);
    expect(await getCachedSummary('https://example.com/a', 'AR')).toEqual(summary);
    expect(await getCachedSummary('https://example.com/a', 'es')).toBeNull();
    expect(await getCachedSummary('https://example.com/b', 'ar')).toBeNull();
  });
});
```

and in the test `'counts and clears both caches without touching other keys'`, replace the `setCachedSummary` line with:

```ts
    await setCachedSummary('https://example.com/a', 'ar', { language: 'ar', english: 'e', translation: 'ع' });
```

In `src/lib/storage/migrate.test.ts`:

1. Replace the first three lines (the imports) with:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { cacheStats, setCachedCard } from '@/lib/storage/cache';
import { migrateCard, migrateSavedItem, prepareStorage } from '@/lib/storage/migrate';
import { getPrefs } from '@/lib/storage/settings';
import type { Card, SavedItem } from '@/lib/types';
```

2. Append to the end of the file:

```ts
describe('prepareStorage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('keeps an existing install on Arabic and Advanced, converts saved words and drops cached answers', async () => {
    await fakeBrowser.storage.local.set({ prefs: { theme: 'light' }, saved: [oldItem] });
    await setCachedCard('k1', migrateCard(oldSentence));
    await prepareStorage('update', 'en-US');
    expect(await getPrefs()).toEqual({ theme: 'light', language: 'ar', level: 'C1' });
    expect(await cacheStats()).toEqual({ cards: 0, summaries: 0 });
    const { saved } = await fakeBrowser.storage.local.get('saved');
    expect((saved as SavedItem[])[0]?.card).toEqual(migrateCard(oldWord));
  });

  it('treats an existing install that never changed a setting the same way', async () => {
    await prepareStorage('update', 'es-ES');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'ar', level: 'C1' });
  });

  it('starts a new install on the browser language and Upper-intermediate', async () => {
    await prepareStorage('install', 'es-MX');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'es', level: 'B2' });
  });

  it('starts a new install in English only when the browser language is English', async () => {
    await prepareStorage('install', 'en-GB');
    expect((await getPrefs()).language).toBe('none');
  });

  it('leaves chosen settings and the cache alone on later updates', async () => {
    await fakeBrowser.storage.local.set({ prefs: { theme: 'dark', language: 'ja', level: 'B1' } });
    await setCachedCard('k1', migrateCard(oldSentence));
    await prepareStorage('update', 'en-US');
    expect(await getPrefs()).toEqual({ theme: 'dark', language: 'ja', level: 'B1' });
    expect((await cacheStats()).cards).toBe(1);
  });
});
```

Run: `pnpm vitest run src/lib/llm/lookup.test.ts src/lib/llm/summary.test.ts src/lib/storage/cache.test.ts src/lib/storage/migrate.test.ts`
Expected: FAIL in the new tests.

- [ ] **Step 2: Key the card cache by the reader**

In `src/lib/llm/lookup.ts`:

1. Replace `cacheKeyFor` and its comment with:

```ts
/** Cache key: prompt version + provider and model + reader + kind + page + paragraph + selection + which occurrence. */
export async function cacheKeyFor(req: LookupRequest, modelId: string, reader: Reader): Promise<string> {
  const material = [
    `v${PROMPT_VERSION}`,
    modelId,
    reader.language.toLowerCase(),
    reader.level,
    req.kind,
    normalizeUrl(req.page.url),
    req.paragraph,
    req.selection,
    buildNumberedPassage(req.passage),
    req.selectedIndices.join(','),
  ].join('\u0001');
  return sha256Hex(material);
}
```

2. In `LookupDeps`, change `getSummary` to:

```ts
  getSummary(url: string, language: string): Promise<Summary | null>;
```

3. In `performLookup`:
   - Move the line `const { reader } = deps;` up so it is the first statement after the `too_long` check.
   - Replace `const key = await cacheKeyFor(req, deps.modelId);` with `const key = await cacheKeyFor(req, deps.modelId, reader);`.
   - Replace `const summary = await deps.getSummary(req.page.url);` with `const summary = await deps.getSummary(req.page.url, reader.language);`.

- [ ] **Step 3: Key the summary cache by the language**

In `src/lib/storage/cache.ts`, replace `summaryKey`, `getCachedSummary` and `setCachedSummary` with:

```ts
async function summaryKey(url: string, language: string): Promise<string> {
  return SUMMARY_PREFIX + (await sha256Hex(`${normalizeUrl(url)}\u0001${language.toLowerCase()}`));
}

/** One summary per page and translation language. */
export async function getCachedSummary(url: string, language: string): Promise<Summary | null> {
  return read<Summary>(await summaryKey(url, language));
}

export async function setCachedSummary(url: string, language: string, summary: Summary, at = Date.now()): Promise<void> {
  const entry: Entry<Summary> = { v: summary, at };
  await browser.storage.local.set({ [await summaryKey(url, language)]: entry });
}
```

In `src/lib/llm/summary.ts`:

1. Replace `SummaryCache` with:

```ts
export interface SummaryCache {
  get(url: string, language: string): Promise<Summary | null>;
  set(url: string, language: string, summary: Summary): Promise<void>;
}
```

2. In `summarize`, replace `await deps.cache.set(input.url, validated.card);` with `await deps.cache.set(input.url, deps.language, validated.card);`.

3. Replace `performSummary` and its comment with:

```ts
/** Summarises a page once per language: cached per URL and language, and concurrent callers share one request. */
export async function performSummary(input: SummaryInput, deps: SummaryDeps): Promise<SummaryResponse> {
  if (!input.text.trim()) {
    return { ok: false, error: { code: 'bad_request', message: 'This page has no readable text to summarise.' } };
  }
  const cached = await deps.cache.get(input.url, deps.language);
  if (cached) return { ok: true, summary: cached, cached: true };
  const key = `${normalizeUrl(input.url)}\u0001${deps.language.toLowerCase()}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const run = summarize(input, deps).finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}
```

- [ ] **Step 4: Write the install and update step**

In `src/lib/storage/migrate.ts`, replace the import line with:

```ts
import { browser } from 'wxt/browser';
import { languageFromBrowser } from '@/lib/languages';
import { clearCaches } from '@/lib/storage/cache';
import { setPrefs } from '@/lib/storage/settings';
import type { Card, Prefs, SavedItem } from '@/lib/types';
```

and append to the end of the file:

```ts
// The same storage keys as `settings.ts` and `saved.ts`, read raw here because this step must see
// what is really stored, without defaults and without the conversion `saved.ts` applies on read.
const PREFS_KEY = 'prefs';
const SAVED_KEY = 'saved';

/**
 * Runs when the extension is installed or updated.
 * - No language stored yet, on an update: this install predates the language setting, so it stays on
 *   Arabic and Advanced, and its cached answers, which have the old shape, are removed.
 * - No language stored yet, on a new install: start with the browser's language and Upper-intermediate.
 * - Saved words are rewritten in the current shape.
 */
export async function prepareStorage(reason: string, uiLanguage: string): Promise<void> {
  const stored = await browser.storage.local.get([PREFS_KEY, SAVED_KEY]);
  const prefs = (stored[PREFS_KEY] ?? {}) as Partial<Prefs>;
  if (typeof prefs.language !== 'string') {
    if (reason === 'update') {
      await setPrefs({ language: 'ar', level: 'C1' });
      await clearCaches();
    } else if (reason === 'install') {
      await setPrefs({ language: languageFromBrowser(uiLanguage), level: 'B2' });
    }
  }
  const saved = stored[SAVED_KEY];
  if (Array.isArray(saved) && saved.length) {
    await browser.storage.local.set({ [SAVED_KEY]: (saved as SavedItem[]).map(migrateSavedItem) });
  }
}
```

- [ ] **Step 5: Read the settings in the background worker**

In `src/entrypoints/background.ts`:

1. Add the import:

```ts
import { prepareStorage } from '@/lib/storage/migrate';
```

2. Replace the two lines added in Task 4 (the comment and `const reader: Reader = …`) with:

```ts
  const currentReader = async (): Promise<Reader> => {
    const { language, level } = await getPrefs();
    return { language, level };
  };
```

3. Replace the `onInstalled` listener with:

```ts
  browser.runtime.onInstalled.addListener(({ reason }) => {
    // Chrome 130+: keep local storage (where keys and tokens live) out of reach of content scripts.
    const local = browser.storage.local as unknown as { setAccessLevel?: (o: { accessLevel: string }) => Promise<void> };
    local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => undefined);
    // The settings are stored before the options page opens, so it shows the starting language at once.
    void prepareStorage(reason, browser.i18n.getUILanguage())
      .catch(() => log.warn('prepare_storage_failed'))
      .finally(() => {
        if (reason === 'install') void browser.runtime.openOptionsPage();
      });
  });
```

4. Replace the `lookup`, `getSummary` and `summarize` handlers with:

```ts
  onMessage('lookup', async ({ data }) => {
    const r = await resolveActiveClient();
    if ('error' in r) return { ok: false, error: r.error };
    return performLookup(data, { client: r.client, modelId: r.modelId, reader: await currentReader(), cache: cardCache, getSummary: getCachedSummary });
  });

  onMessage('getSummary', async ({ data }) => getCachedSummary(data, (await getPrefs()).language));

  onMessage('summarize', async ({ data }) => {
    const r = await resolveActiveClient();
    if ('error' in r) return { ok: false, error: r.error };
    return performSummary(data, { client: r.client, cache: summaryCache, language: (await getPrefs()).language });
  });
```

- [ ] **Step 6: Run everything**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all tests pass, the type check exits 0, the build finishes.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "Use the reader's language and level for lookups, summaries and their caches"
```

---

### Task 6: Show translations in any language, and English-only cards

**Files:**
- Create: `src/ui/components/Translated.tsx`, `src/ui/card/title.ts`, `src/ui/card/views.test.tsx`
- Delete: `src/ui/components/Arabic.tsx`
- Modify: `src/ui/theme.css` (the `.arabic` rule), `src/ui/card/DictionaryView.tsx`, `src/ui/card/TranslationView.tsx`, `src/ui/card/SummaryView.tsx`, `src/ui/card/CardFrame.tsx`, `src/entrypoints/popup/App.tsx`, `src/entrypoints/words/App.tsx`, `playground/main.tsx`

**Interfaces:**
- Consumes: `resolveLanguage` (Task 2); the card shapes (Task 3).
- Produces:
  - `Translated({ language, children, className?, as? })` from `@/ui/components/Translated`, where `as` is `'p' | 'span' | 'div'` and defaults to `'p'`
  - `TranslatedMeaning({ card, className? })` from `@/ui/card/DictionaryView` (replaces `ArabicMeaning`)
  - `cardTitle(entry: CardEntry, showSummary: boolean): string` from `@/ui/card/title`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/card/views.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DictionaryCard, TranslationCard } from '@/lib/types';
import { DictionaryView } from '@/ui/card/DictionaryView';
import { SummaryView } from '@/ui/card/SummaryView';
import { TranslationView } from '@/ui/card/TranslationView';
import type { CardEntry } from '@/ui/card/state';
import { cardTitle } from '@/ui/card/title';
import { Translated } from '@/ui/components/Translated';

const word: DictionaryCard = {
  kind: 'word',
  language: 'ar',
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  ipaUk: 'ˌtɜːn ˈdaʊn',
  ipaUs: 'ˌtɝːn ˈdaʊn',
  unitIndices: [3, 6],
  meaning: 'to refuse an offer',
  translation: 'رفض',
  notes: [],
  sentenceTranslation: 'رفضوا العرض.',
  examples: ['She turned down the job.'],
  combinations: [],
  otherMeanings: [{ meaning: 'to reduce the volume', translation: 'خفّض' }],
};
const { translation: _t, sentenceTranslation: _s, ...wordEnglish } = word;
const englishOnlyWord: DictionaryCard = { ...wordEnglish, language: 'none', otherMeanings: [{ meaning: 'to reduce the volume' }] };

const sentence: TranslationCard = {
  kind: 'sentence',
  language: 'es',
  translation: 'El acuerdo fracasó.',
  plainEnglish: '',
  keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'failed', translation: 'fracasó' }],
};
const englishOnlySentence: TranslationCard = {
  kind: 'sentence',
  language: 'none',
  plainEnglish: 'The deal failed.',
  keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'failed' }],
};

describe('Translated', () => {
  it('sets direction, language and script for a listed language', () => {
    expect(renderToStaticMarkup(<Translated language="fa">سلام</Translated>)).toBe('<p dir="rtl" lang="fa" data-script="Arabic" class="translated">سلام</p>');
    expect(renderToStaticMarkup(<Translated language="es" as="span" className="x">hola</Translated>)).toBe('<span dir="ltr" lang="es" class="translated x">hola</span>');
  });

  it('lets the browser pick the direction of a typed language', () => {
    expect(renderToStaticMarkup(<Translated language="x:Kurdish">سڵاو</Translated>)).toBe('<p dir="auto" class="translated">سڵاو</p>');
  });
});

describe('DictionaryView', () => {
  it('shows the translations in the card language', () => {
    const html = renderToStaticMarkup(<DictionaryView card={word} sentence="They turned the offer down." />);
    expect(html).toContain('رفض');
    expect(html).toContain('رفضوا العرض.');
    expect(html).toContain('Show translation');
    expect(html).toContain('lang="ar"');
  });

  it('shows no translation rows for an English-only card', () => {
    const html = renderToStaticMarkup(<DictionaryView card={englishOnlyWord} sentence="They turned the offer down." />);
    expect(html).not.toContain('translated');
    expect(html).not.toContain('Show translation');
    expect(html).toContain('to refuse an offer');
    expect(html).toContain('They turned the offer down.');
  });
});

describe('TranslationView', () => {
  const noop = () => undefined;

  it('shows the translation and the key expression translations', () => {
    const html = renderToStaticMarkup(<TranslationView card={sentence} selection="The deal fell through." onKeyExpression={noop} />);
    expect(html).toContain('El acuerdo fracasó.');
    expect(html).toContain('fracasó');
    expect(html).toContain('lang="es"');
  });

  it('shows only English for an English-only card', () => {
    const html = renderToStaticMarkup(<TranslationView card={englishOnlySentence} selection="The deal fell through." onKeyExpression={noop} />);
    expect(html).not.toContain('translated');
    expect(html).toContain('In plain English');
    expect(html).toContain('The deal failed.');
    expect(html).toContain('fell through');
  });
});

describe('SummaryView', () => {
  it('shows the translation only when the summary has one', () => {
    const translated = renderToStaticMarkup(<SummaryView summary={{ status: 'ready', summary: { language: 'ja', english: 'A summary.', translation: '要約です。' } }} />);
    expect(translated).toContain('要約です。');
    expect(translated).toContain('lang="ja"');
    const englishOnly = renderToStaticMarkup(<SummaryView summary={{ status: 'ready', summary: { language: 'none', english: 'A summary.' } }} />);
    expect(englishOnly).toContain('A summary.');
    expect(englishOnly).not.toContain('translated');
  });
});

describe('cardTitle', () => {
  const entry = (extra: Partial<CardEntry>): CardEntry => ({ key: 'k', kind: 'sentence', selection: 'The deal fell through.', status: 'ready', saved: false, ...extra });

  it('names a sentence card by what it gives', () => {
    expect(cardTitle(entry({ card: sentence }), false)).toBe('Translation');
    expect(cardTitle(entry({ card: englishOnlySentence }), false)).toBe('Explanation');
  });

  it('does not promise a translation before the answer arrives', () => {
    expect(cardTitle(entry({ status: 'loading' }), false)).toBe('Reading…');
    expect(cardTitle(entry({ status: 'error' }), false)).toBe('Sentence');
  });

  it('keeps the word card and summary titles', () => {
    expect(cardTitle(entry({ kind: 'word', selection: 'turned', status: 'loading' }), false)).toBe('Looking up…');
    expect(cardTitle(entry({ kind: 'word', selection: 'turned', status: 'error' }), false)).toBe('turned');
    expect(cardTitle(entry({ kind: 'word', selection: 'turned', card: word }), false)).toBe('turn down');
    expect(cardTitle(entry({ card: sentence }), true)).toBe('Article summary');
  });
});
```

Run: `pnpm vitest run src/ui/card/views.test.tsx`
Expected: FAIL, because `@/ui/card/title` and `@/ui/components/Translated` do not exist.

- [ ] **Step 2: Add the `Translated` component and remove `Arabic`**

Create `src/ui/components/Translated.tsx`:

```tsx
import type { ReactNode } from 'react';
import { resolveLanguage } from '@/lib/languages';

/** Text in the reader's language: sets its direction, its lang attribute and its script (for fonts). */
export function Translated({
  language,
  children,
  className = '',
  as: Tag = 'p',
}: {
  language: string;
  children: ReactNode;
  className?: string;
  as?: 'p' | 'span' | 'div';
}) {
  const l = resolveLanguage(language);
  return (
    <Tag dir={l.dir} lang={l.lang} data-script={l.script} className={['translated', className].filter(Boolean).join(' ')}>
      {children}
    </Tag>
  );
}
```

Delete the old component:

```bash
git rm src/ui/components/Arabic.tsx
```

In `src/ui/theme.css`, replace the `.arabic { … }` rule and the comment above it with:

```css
/* Translated text keeps its own direction, isolated from the English around it. */
.translated {
  unicode-bidi: isolate;
  text-align: start;
}

/* Arabic script (Arabic, Persian, Urdu): its own font stack, a little larger because the script sits lower. */
.translated[data-script="Arabic"] {
  font-family: var(--font-arabic);
  font-size: 1.08em;
  line-height: 1.9;
}
```

- [ ] **Step 3: Add the card title function**

Create `src/ui/card/title.ts`:

```ts
import type { CardEntry } from './state';

/**
 * The card's header title. A sentence card is a translation, or an explanation when it is English
 * only. Before the answer arrives the card does not know which, so the title stays neutral.
 */
export function cardTitle(entry: CardEntry, showSummary: boolean): string {
  if (showSummary) return 'Article summary';
  const isWord = entry.kind === 'word';
  if (entry.status === 'loading') return isWord ? 'Looking up…' : 'Reading…';
  if (entry.status === 'error') return isWord ? entry.selection : 'Sentence';
  if (entry.card?.kind === 'word') return entry.card.headword;
  return entry.card?.language === 'none' ? 'Explanation' : 'Translation';
}
```

In `src/ui/card/CardFrame.tsx`:

1. Add the import next to the other local imports:

```ts
import { cardTitle } from './title';
```

2. Replace the six lines from `let title: string;` to `else title = 'Translation';` with:

```ts
  const title = cardTitle(entry, card.showSummary);
```

- [ ] **Step 4: Update the word card**

In `src/ui/card/DictionaryView.tsx`:

1. Replace `import { Arabic } from '@/ui/components/Arabic';` with:

```ts
import { Translated } from '@/ui/components/Translated';
```

2. Replace the `ArabicMeaning` function and its comment with:

```tsx
/** This sense in the reader's language. Cards saved while the explanation was separate also show it. */
export function TranslatedMeaning({ card, className = '' }: { card: DictionaryCard; className?: string }) {
  if (!card.translation) return null;
  return (
    <Translated as="div" language={card.language} className={className}>
      <p className="text-[16px] font-medium">{card.translation}</p>
      {card.translationNote && <p className="text-[14px] leading-relaxed">{card.translationNote}</p>}
    </Translated>
  );
}
```

3. Replace `<ArabicMeaning card={card} />` with `<TranslatedMeaning card={card} />`.

4. Replace the whole `<section className="rounded-xl bg-surface-2 p-3">…</section>` block with:

```tsx
      <section className="rounded-xl bg-surface-2 p-3">
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text">
          <SentenceText segments={segments} sentence={sentence} />
        </p>
        {card.sentenceTranslation && (
          <div className="mt-2 border-t border-border pt-2">
            <BlurReveal>
              <Translated language={card.language} className="text-[14px]">
                {card.sentenceTranslation}
              </Translated>
            </BlurReveal>
          </div>
        )}
      </section>
```

5. In the other meanings list, replace the `<Arabic as="span" …>…</Arabic>` element with:

```tsx
                {m.translation && (
                  <Translated as="span" language={card.language} className="text-[13px] text-muted">
                    {m.translation}
                  </Translated>
                )}
```

- [ ] **Step 5: Update the sentence card, the summary and the popup**

In `src/ui/card/TranslationView.tsx`:

1. Replace `import { Arabic } from '@/ui/components/Arabic';` with `import { Translated } from '@/ui/components/Translated';`.

2. Replace `<Arabic className="whitespace-pre-wrap text-[15px]">{card.translation}</Arabic>` with:

```tsx
      {card.translation && (
        <Translated language={card.language} className="whitespace-pre-wrap text-[15px]">
          {card.translation}
        </Translated>
      )}
```

3. Replace the `<Arabic as="span" …>…</Arabic>` element inside the key expressions with:

```tsx
                  {k.translation && (
                    <Translated as="span" language={card.language} className="ml-2 inline-block text-[13px] text-muted">
                      {k.translation}
                    </Translated>
                  )}
```

In `src/ui/card/SummaryView.tsx`:

1. Replace `import { Arabic } from '@/ui/components/Arabic';` with `import { Translated } from '@/ui/components/Translated';`.

2. Replace the `<Arabic …>{summary.summary.translation}</Arabic>` line with:

```tsx
        {summary.summary.translation && (
          <Translated language={summary.summary.language} className="whitespace-pre-wrap border-t border-border pt-3">
            {summary.summary.translation}
          </Translated>
        )}
```

In `src/entrypoints/popup/App.tsx`:

1. Replace `import { Arabic } from '@/ui/components/Arabic';` with `import { Translated } from '@/ui/components/Translated';`.

2. Replace the `<Arabic …>{summary.summary.translation}</Arabic>` line with:

```tsx
                {summary.summary.translation && (
                  <Translated language={summary.summary.language} className="whitespace-pre-wrap border-t border-border pt-2 text-[13px]">
                    {summary.summary.translation}
                  </Translated>
                )}
```

- [ ] **Step 6: Update the My words page**

In `src/entrypoints/words/App.tsx`:

1. Replace the two imports

```ts
import { ArabicMeaning, SentenceText } from '@/ui/card/DictionaryView';
import { Arabic } from '@/ui/components/Arabic';
```

with

```ts
import { SentenceText, TranslatedMeaning } from '@/ui/card/DictionaryView';
import { Translated } from '@/ui/components/Translated';
```

and move the `Translated` import so the imports stay in alphabetical order (after `SpeakButton`).

2. Replace `<ArabicMeaning card={item.card} />` with `<TranslatedMeaning card={item.card} />`.

3. Replace `<Arabic className="text-[13px] text-muted">{item.card.sentenceTranslation}</Arabic>` with:

```tsx
                      {item.card.sentenceTranslation && (
                        <Translated language={item.card.language} className="text-[13px] text-muted">
                          {item.card.sentenceTranslation}
                        </Translated>
                      )}
```

4. Replace `<Arabic className="whitespace-pre-wrap text-[14px]">{item.card.translation}</Arabic>` with (an English-only sentence shows its plainer English instead):

```tsx
                      {item.card.translation ? (
                        <Translated language={item.card.language} className="whitespace-pre-wrap text-[14px]">
                          {item.card.translation}
                        </Translated>
                      ) : (
                        <p className="text-[14px] leading-relaxed">{item.card.plainEnglish}</p>
                      )}
```

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run src/ui/card/views.test.tsx`
Expected: PASS.

- [ ] **Step 8: Add playground scenarios for other languages and English only**

In `playground/main.tsx`, below the `translation` constant, add:

```ts
const dictionarySpanish: DictionaryCard = {
  ...dictionary,
  language: 'es',
  translation: 'rechazar',
  sentenceTranslation: 'Tras un breve debate, la junta rechazó la oferta.',
  otherMeanings: [
    { meaning: 'to reduce the sound, heat or power of a machine', translation: 'bajar' },
    { meaning: 'to fold part of something downwards', translation: 'doblar hacia abajo' },
  ],
};
const { translation: _dt, sentenceTranslation: _ds, ...dictionaryEnglish } = dictionary;
const dictionaryEnglishOnly: DictionaryCard = {
  ...dictionaryEnglish,
  language: 'none',
  otherMeanings: dictionary.otherMeanings.map((m) => ({ meaning: m.meaning })),
};
const explanation: TranslationCard = {
  kind: 'sentence',
  language: 'none',
  plainEnglish: translation.plainEnglish,
  keyExpressions: translation.keyExpressions.map(({ translation: _kt, ...k }) => k),
};
```

In the `scenarios` array, add these entries before the `'summary'` entry:

```ts
  { name: 'dictionary spanish', state: () => ({ ...base(), card: { anchor, showSummary: false, stack: [ready({ card: dictionarySpanish })] } }) },
  { name: 'dictionary english only', state: () => ({ ...base(), card: { anchor, showSummary: false, stack: [ready({ card: dictionaryEnglishOnly })] } }) },
  {
    name: 'explanation english only',
    state: () => ({
      ...base(),
      card: { anchor, showSummary: false, stack: [entry({ kind: 'sentence', status: 'ready', card: explanation, id: 'z', selection: longSelection })] },
    }),
  },
  {
    name: 'summary english only',
    state: () => ({ ...base(), summary: { status: 'ready', summary: { language: 'none', english: summaryText.english } }, card: { anchor, showSummary: true, stack: [ready()] } }),
  },
```

- [ ] **Step 9: Look at the cards in the playground**

Start the playground with the preview tool (launch configuration `playground`, port 5178). Open each address and read the page:

| Address | Expected |
|---|---|
| `http://localhost:5178/#dictionary` | Arabic under the meaning, right-aligned, in the Arabic font; the sentence box has "Show translation" |
| `http://localhost:5178/#dictionary%20spanish` | "rechazar" under the meaning, left-aligned, in the interface font |
| `http://localhost:5178/#dictionary%20english%20only` | No line under the meaning; the sentence box has no "Show translation" row |
| `http://localhost:5178/#explanation%20english%20only` | Title "Explanation"; "In plain English" and the key expressions, no translation |
| `http://localhost:5178/#summary%20english%20only` | The English summary alone, with no line under it |
| `http://localhost:5178/#translation` | Title "Translation"; Arabic text as before |

Reload the page after changing the hash, because the playground reads it once.

- [ ] **Step 10: Run everything and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all pass.

Run: `grep -rn "Arabic'\|ArabicMeaning\|className=\"arabic\|\.arabic\b" src playground --include="*.ts" --include="*.tsx" --include="*.css"`
Expected: no output.

```bash
git add -A src playground
git commit -m "Show translations in the card's own language and lay out English-only cards"
```

---

### Task 7: The Reading section in settings

**Files:**
- Create: `src/entrypoints/options/ReadingSection.tsx`, `src/entrypoints/options/ReadingSection.test.ts`
- Modify: `src/entrypoints/options/App.tsx`

**Interfaces:**
- Consumes: `LANGUAGES`, `NO_TRANSLATION`, `otherLanguageId`, `otherLanguageName` (Task 2); `getPrefs`, `setPrefs` from `@/lib/storage/settings`; `Level`, `Prefs`.
- Produces: `ReadingSection()` and `listChoice(language: string): string` from `./ReadingSection`.

- [ ] **Step 1: Write the failing test**

Create `src/entrypoints/options/ReadingSection.test.ts`:

```ts
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
```

Run: `pnpm vitest run src/entrypoints/options/ReadingSection.test.ts`
Expected: FAIL, because `./ReadingSection` does not exist.

- [ ] **Step 2: Write the section**

Create `src/entrypoints/options/ReadingSection.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { LANGUAGES, NO_TRANSLATION, otherLanguageId, otherLanguageName } from '@/lib/languages';
import { getPrefs, setPrefs } from '@/lib/storage/settings';
import type { Level, Prefs } from '@/lib/types';

const OTHER = 'other';
const LEVELS: Array<{ id: Level; label: string }> = [
  { id: 'B1', label: 'Intermediate (B1)' },
  { id: 'B2', label: 'Upper-intermediate (B2)' },
  { id: 'C1', label: 'Advanced (C1)' },
];
const listed = new Set(LANGUAGES.map((l) => l.id));

/** Which entry of the list a stored language id selects. */
export function listChoice(language: string): string {
  return language === NO_TRANSLATION || listed.has(language) ? language : OTHER;
}

/** The translation language and the reading level. Both are saved as soon as they change. */
export function ReadingSection() {
  const [prefs, setLocalPrefs] = useState<Prefs | null>(null);
  const [other, setOther] = useState({ open: false, text: '' });

  useEffect(() => {
    void getPrefs().then((p) => {
      setLocalPrefs(p);
      if (listChoice(p.language) === OTHER) setOther({ open: true, text: otherLanguageName(p.language) || p.language });
    });
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes.prefs?.newValue) setLocalPrefs(changes.prefs.newValue as Prefs);
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  if (!prefs) return null;
  const choice = other.open ? OTHER : listChoice(prefs.language);

  const choose = (value: string) => {
    if (value !== OTHER) {
      setOther((o) => ({ ...o, open: false }));
      void setPrefs({ language: value });
      return;
    }
    setOther((o) => ({ ...o, open: true }));
    // With an empty box nothing is saved and the previous choice stays.
    const id = otherLanguageId(other.text);
    if (id) void setPrefs({ language: id });
  };

  const typeOther = (text: string) => {
    setOther({ open: true, text });
    const id = otherLanguageId(text);
    if (id) void setPrefs({ language: id });
  };

  return (
    <div className="space-y-4 text-[13px]">
      <label className="block space-y-1.5">
        <span className="font-medium">Translate into</span>
        <select className="input max-w-[360px]" value={choice} onChange={(e) => choose(e.target.value)}>
          <option value={NO_TRANSLATION}>English only (no translation)</option>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nativeName} · {l.englishName}
            </option>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
      </label>

      {choice === OTHER && (
        <label className="block space-y-1.5">
          <span className="text-muted">Language name in English, for example Kurdish</span>
          <input className="input max-w-[360px]" value={other.text} maxLength={40} onChange={(e) => typeOther(e.target.value)} />
        </label>
      )}

      <fieldset className="space-y-1.5">
        <legend className="font-medium">My English level</legend>
        <div className="flex flex-wrap gap-4">
          {LEVELS.map((l) => (
            <label key={l.id} className="flex items-center gap-2">
              <input type="radio" name="level" checked={prefs.level === l.id} onChange={() => void setPrefs({ level: l.id })} className="accent-amber" />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-muted">These apply to new lookups. Saved words keep the language they were saved in.</p>
    </div>
  );
}
```

Run: `pnpm vitest run src/entrypoints/options/ReadingSection.test.ts`
Expected: PASS.

- [ ] **Step 3: Put the section at the top of the settings page**

In `src/entrypoints/options/App.tsx`:

1. Add the import below `import { ProviderSection } from './ProviderSection';`:

```ts
import { ReadingSection } from './ReadingSection';
```

2. Directly above `<Section title="AI provider" …>`, add:

```tsx
      <Section title="Reading" intro="Choose the language of the translations and how much the cards explain.">
        <ReadingSection />
      </Section>
```

3. In the Privacy paragraph, replace `the selection, and the article summary once it exists, to the provider you chose` with `the selection, the article summary once it exists, and the name of your translation language, to the provider you chose`.

- [ ] **Step 4: Try it in the playground**

With the playground running, open `http://localhost:5178/settings.html` and check:

1. "Reading" is the first section, above "AI provider". The list shows "English only (no translation)" (the playground starts with no stored preferences) and "Upper-intermediate (B2)" is selected.
2. Choose "Español · Spanish". In the page's JavaScript console, `await chrome.storage.local.get('prefs')` shows `language: 'es'`.
3. Choose "Other…". A text box appears and the stored language is still `'es'`. Type `Kurdish`: the stored language becomes `'x:Kurdish'`.
4. Choose "Advanced (C1)": the stored level becomes `'C1'`.
5. The list is readable in the dark theme and in the light theme (switch under Appearance).

If the closed list is hard to read in one theme, add `appearance-auto` to the `select`'s class and check again.

- [ ] **Step 5: Run everything and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all pass.

```bash
git add src/entrypoints/options
git commit -m "Add the Reading section to settings: translation language and English level"
```

---

### Task 8: My words and the CSV export

**Files:**
- Modify: `src/lib/storage/saved.ts`, `src/lib/storage/saved.test.ts`
- Modify: `src/entrypoints/words/App.tsx`

**Interfaces:**
- Consumes: `languageName`, `languageLabel` (Task 2).
- Produces: `CSV_HEADER` is `kind, headword, ipa_uk, ipa_us, translation, meaning, sentence, sentence_translation, language, page, url, saved`.

- [ ] **Step 1: Write the failing test**

In `src/lib/storage/saved.test.ts`, replace the whole `describe('export', …)` block with:

```ts
describe('export', () => {
  it('writes CSV with quoting and JSON with all items', () => {
    const items: SavedItem[] = [
      { ...wordItem('a', 'say "hi"', 'قال'), savedAt: Date.UTC(2026, 9, 16) },
    ];
    const csv = toCsv(items);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('kind,headword,ipa_uk,ipa_us,translation,meaning,sentence,sentence_translation,language,page,url,saved');
    expect(lines[1]).toContain(',tɛst,test,');
    expect(lines[1]).toContain('قال — شرح قال');
    expect(lines[1]).toContain('"say ""hi"""');
    expect(lines[1]).toContain(',جملة,Arabic,Page,https://example.com/p,2026-10-16');
    expect(JSON.parse(toJson(items))).toHaveLength(1);
  });

  it('puts a sentence translation in its own column and names the language', () => {
    const sentence = (language: string, translation?: string): SavedItem => ({
      id: language,
      kind: 'sentence',
      card: { kind: 'sentence', language, ...(translation ? { translation } : {}), plainEnglish: 'The deal failed.', keyExpressions: [] },
      selection: 'The deal fell through.',
      sentence: 'The deal fell through.',
      sentenceSegments: [{ text: 'The deal fell through.' }],
      pageTitle: 'News',
      url: 'https://example.com/n',
      savedAt: Date.UTC(2026, 10, 13),
    });
    const lines = toCsv([sentence('es', 'El acuerdo fracasó.'), sentence('x:Kurdish', 'Peyman têk çû.'), sentence('none')]).split('\n');
    expect(lines[1]).toBe('sentence,,,,,The deal failed.,The deal fell through.,El acuerdo fracasó.,Spanish,News,https://example.com/n,2026-11-13');
    expect(lines[2]).toContain(',Peyman têk çû.,Kurdish,News,');
    expect(lines[3]).toBe('sentence,,,,,The deal failed.,The deal fell through.,,English only,News,https://example.com/n,2026-11-13');
  });
});
```

Run: `pnpm vitest run src/lib/storage/saved.test.ts`
Expected: FAIL in both export tests.

- [ ] **Step 2: Change the export**

In `src/lib/storage/saved.ts`:

1. Add the import:

```ts
import { languageName } from '@/lib/languages';
```

2. Replace `CSV_HEADER` and `toCsv` with:

```ts
export const CSV_HEADER = ['kind', 'headword', 'ipa_uk', 'ipa_us', 'translation', 'meaning', 'sentence', 'sentence_translation', 'language', 'page', 'url', 'saved'];

export function toCsv(items: SavedItem[]): string {
  const rows = items.map((item) => {
    const saved = new Date(item.savedAt).toISOString().slice(0, 10);
    // A word's translation and its sentence's translation each have a column; a sentence item uses only the second.
    const cells =
      item.card.kind === 'word'
        ? ['word', item.card.headword, item.card.ipaUk ?? '', item.card.ipaUs ?? '', translationText(item.card), item.card.meaning, item.sentence, item.card.sentenceTranslation ?? '']
        : ['sentence', '', '', '', '', item.card.plainEnglish, item.selection, item.card.translation ?? ''];
    return [...cells, languageName(item.card.language), item.pageTitle, item.url, saved].map(csvCell).join(',');
  });
  return [CSV_HEADER.join(','), ...rows].join('\n');
}
```

3. Change the comment above `foldText` to:

```ts
/** Lowercases text and folds Arabic diacritics and letter variants so searches are forgiving. */
```

Run: `pnpm vitest run src/lib/storage/saved.test.ts`
Expected: PASS.

- [ ] **Step 3: Update the My words page**

In `src/entrypoints/words/App.tsx`:

1. Add the import (keep the imports in alphabetical order by path):

```ts
import { languageLabel } from '@/lib/languages';
```

2. Below the `counts` constant, add:

```ts
  // The language is shown on each item only when the list mixes languages.
  const showLanguage = new Set(items.map((i) => i.card.language)).size > 1;
```

3. Replace `placeholder="Search in English or Arabic…"` with `placeholder="Search your words…"`.

4. In the details line, directly after `<span>{new Date(item.savedAt).toLocaleDateString()}</span>`, add:

```tsx
                    {showLanguage && <span>{languageLabel(item.card.language)}</span>}
```

- [ ] **Step 4: Look at the page in the playground**

With the playground running, open `http://localhost:5178/store/words.html`:

1. The search box says "Search your words…". No item shows a language name, because all five fixtures are Arabic.
2. In the page's JavaScript console run:

```js
const { saved } = await chrome.storage.local.get('saved');
saved[0].card.language = 'es';
await chrome.storage.local.set({ saved });
```

Expected: every item now shows its language in the details line: "Español" on the first, "العربية" on the others.

- [ ] **Step 5: Run everything and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all pass.

```bash
git add src/lib/storage/saved.ts src/lib/storage/saved.test.ts src/entrypoints/words/App.tsx
git commit -m "Name the language in My words and in the CSV export"
```

---

### Task 9: Language and level flags for the evaluation script

**Files:**
- Modify: `scripts/eval/run.ts`

**Interfaces:**
- Consumes: `Reader` (Task 4), `languageName`, `NO_TRANSLATION` (Task 2), `Level`.
- Produces: `pnpm eval --language <id> --level <B1|B2|C1>`; reports are written to `scripts/eval/out/report-<language>-<level>.md`.

- [ ] **Step 1: Add the flags**

In `scripts/eval/run.ts`:

1. In the comment at the top of the file, add these lines after the `--pick` line:

```ts
 *   pnpm eval --live --language es --level B2   reader settings: a language id from src/lib/languages.ts
 *        ("none" for English only, "x:Kurdish" for a typed language) and B1, B2 or C1.
 *        Defaults: ar and C1. The report goes to scripts/eval/out/report-<language>-<level>.md.
```

2. Add the import, and add `Level` to the existing type import from `@/lib/types`:

```ts
import { NO_TRANSLATION, languageName } from '@/lib/languages';
```

3. Replace the line `const reader: Reader = { language: 'ar', level: 'C1' };` (added in Task 4) with:

```ts
const level = (flagValue('--level') ?? 'C1') as Level;
if (!['B1', 'B2', 'C1'].includes(level)) {
  console.error(`Unknown level "${level}". Use B1, B2 or C1.`);
  process.exit(1);
}
const reader: Reader = { language: flagValue('--language') ?? 'ar', level };
const readerLabel = `${languageName(reader.language)}, ${reader.level}`;
```

4. In `cardMarkdown`, replace the lines that print translations so an absent one reads "(none)":

```ts
      `- translation: ${card.translation ?? '(none)'}`,
```

```ts
      `- sentence translation: ${card.sentenceTranslation ?? '(none)'}`,
```

```ts
      `- other meanings: ${card.otherMeanings.length ? card.otherMeanings.map((m) => (m.translation ? `${m.meaning} (${m.translation})` : m.meaning)).join(' | ') : '(none)'}`,
```

and, for the sentence card:

```ts
    `- translation: ${card.translation ?? '(none)'}`,
```

```ts
    `- key expressions: ${card.keyExpressions.length ? card.keyExpressions.map((k) => `${k.expression} ${JSON.stringify(k.indices)}: ${k.meaning}${k.translation ? ` (${k.translation})` : ''}`).join(' | ') : '(none)'}`,
```

5. In `flags`, add this check at the end of the `else` branch (sentence cards), before its closing brace:

```ts
    if (reader.language === NO_TRANSLATION && !card.plainEnglish) out.push('English only without plain English');
```

6. In `main`:
   - Directly above the line `const report: string[] = …`, add this line, so a dry run prints it too:

```ts
  console.log(`Reader: ${readerLabel}`);
```

   - Replace the first `report` line with:

```ts
  const report: string[] = [`# Siyaq evaluation ${new Date().toISOString().slice(0, 10)} · ${readerLabel}${live ? '' : ' (dry run)'}`, ''];
```

   - Replace `const file = new URL('report.md', outDir);` with:

```ts
  const slug = reader.language.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const file = new URL(`report-${slug}-${reader.level}.md`, outDir);
```

- [ ] **Step 2: Check with a dry run**

Run: `pnpm eval --only pg --pick aptitude --language es --level B2`
Expected: prints `Reader: Spanish, B2`, one selection line for "aptitude", and ends with `Report: …/scripts/eval/out/report-es-B2.md`. No model is called.

Run: `pnpm eval --only pg --pick aptitude --level A1`
Expected: prints `Unknown level "A1". Use B1, B2 or C1.` and exits with an error.

- [ ] **Step 3: Run everything and commit**

Run: `pnpm test && pnpm typecheck`
Expected: all pass.

```bash
git add scripts/eval/run.ts
git commit -m "Let the evaluation script run for any translation language and level"
```

---

### Task 10: Live checks in five languages

This task calls the model and spends the user's API money: about 90 calls with the default Anthropic model (seven runs of 12 selections and one summary). **Before Step 1 and again before any re-run, tell the user how many calls the batch makes and wait for a yes.**

**Files:**
- Modify (only if the checks show a problem): `src/lib/llm/prompts.ts`, `src/lib/llm/prompts.test.ts`

- [ ] **Step 1: Get a baseline from the old prompts**

The version-12 prompts are on `main`. Run them on the same sample from a temporary worktree:

```bash
git worktree add ../siyaq-baseline main
cp .env ../siyaq-baseline/.env
(cd ../siyaq-baseline && pnpm install --frozen-lockfile && pnpm eval --live --only pg)
cp ../siyaq-baseline/scripts/eval/out/report.md scripts/eval/out/report-baseline-v12.md
git worktree remove --force ../siyaq-baseline
```

Expected: `scripts/eval/out/report-baseline-v12.md` exists with 13 cases (12 selections and the summary).

- [ ] **Step 2: Run the new prompts**

```bash
pnpm eval --live --only pg --language ar --level C1
pnpm eval --live --only pg --language es --level C1
pnpm eval --live --only pg --language zh-Hans --level C1
pnpm eval --live --only pg --language fa --level C1
pnpm eval --live --only pg --language none --level C1
pnpm eval --live --only pg --language es --level B1
```

Expected: six reports in `scripts/eval/out/`: `report-ar-C1.md`, `report-es-C1.md`, `report-zh-hans-C1.md`, `report-fa-C1.md`, `report-none-C1.md`, `report-es-B1.md`. No run ends with "unusable answer" errors.

- [ ] **Step 3: Read the reports**

Check each report against this list and write down every failure with its selection:

| Check | Applies to |
|---|---|
| Every word card has a translation and a sentence translation, in the right language | ar, es, zh-Hans, fa |
| The translation of a word is the usual equivalent and short (the script flags more than 25 words) | ar, es, zh-Hans, fa |
| No translation is left in English, and none repeats the English meaning | es (it has no script check) |
| Chinese is in simplified characters | zh-Hans |
| Persian is Persian, not Arabic | fa |
| No translation field anywhere; every sentence card has plain English | none |
| Units, headwords, IPA and example counts match the baseline for the same selection | all |
| Arabic: notes appear on the same selections as in the baseline, give or take one; translations are of the same quality | ar against `report-baseline-v12.md` |
| B1 against C1 for Spanish: simpler meanings, plain English on both sentence cards, key expressions on more selections | es B1 against es C1 |

Show the user the Arabic report next to the baseline and ask them to read the Arabic. Theirs is the only native check.

- [ ] **Step 4: Adjust the prompts if a check failed**

Only if Step 3 found failures. Change the smallest piece of `src/lib/llm/prompts.ts` that explains the failure:

| Failure | Where to change |
|---|---|
| Translation fields missing or in English | The `afterExamples` line of the prompt concerned: say it more firmly, and name the fields one by one |
| Translations too long | The `- translation:` rule: move "Keep it brief." to the front as "Keep it to a few words." |
| Arabic notes more frequent than the baseline | `LEVELS.C1.notesOften` and `notesLimit` |
| B1 not simpler than C1 | `LEVELS.B1.meaning` and `LEVELS.B1.examples` |
| Wrong variety (traditional characters, Arabic for Persian) | Add a `variety` to that entry in `src/lib/languages.ts`, for example `'Simplified Chinese as written in mainland China'`, and add the entry to the test `'describes a listed language'` if it is `ar` or `es` |

After each change, keep `pnpm vitest run src/lib/llm/prompts.test.ts src/lib/languages.test.ts` green (update an assertion only when the wording it quotes changed on purpose), ask the user for a yes, and re-run only the affected language with `--pick` limited to the failing selections, for example:

```bash
pnpm eval --live --only pg --language es --level C1 --pick figure,tincture
```

Repeat until the list in Step 3 passes. `PROMPT_VERSION` stays 13: version 13 has not been released.

- [ ] **Step 5: Commit**

If the prompts changed:

```bash
pnpm test && pnpm typecheck && pnpm build
git add src/lib/llm/prompts.ts src/lib/llm/prompts.test.ts src/lib/languages.ts src/lib/languages.test.ts
git commit -m "Adjust the prompts after live checks in Arabic, Spanish, Chinese, Persian and English only"
```

If nothing changed, there is nothing to commit: the reports are in a git-ignored folder. Either way, keep a two-line note of what the checks showed for Task 11.

---

### Task 11: Docs, description and version

**Files:**
- Modify: `README.md`, `docs/PLAN.md`, `package.json`, `wxt.config.ts`

- [ ] **Step 1: Update the description and the version**

In `package.json`, set:

```json
  "version": "0.2.0",
  "description": "Understand English words and sentences in context, with translation into your language, powered by the AI model you choose.",
```

In `wxt.config.ts`, replace the `description` line with:

```ts
    description: 'Understand English words and sentences in context, with translation into your language, powered by the AI model you choose.',
```

Run: `node -e "const d=require('./.output/chrome-mv3/manifest.json'); console.log(d.version, d.description.length)"` after `pnpm build`.
Expected: `0.2.0` and a length of 132 or less.

- [ ] **Step 2: Update the README**

In `README.md`:

1. Replace the opening paragraph (below the `# Siyaq` heading) with:

```markdown
A Chrome extension that replaces Google Translate for reading English articles: a context-aware
dictionary and translator for English learners, in the language and at the reading level you choose.
It works with Claude, GPT, Gemini, any model on OpenRouter, or your ChatGPT plan through Sign in with
ChatGPT. Select a word or a sentence, click the small icon, and get a card that was written after
reading the paragraph and the article, not just the word.
```

2. In the **Trigger** bullet, replace `Selections that are mostly Arabic, another script, or only numbers and symbols don't show it.` with `Selections that are mostly in another script, or only numbers and symbols, don't show it.`

3. Replace the **Dictionary card** bullet with:

```markdown
- **Dictionary card** (up to 4 words): the model decides the unit you mean (a word, or part of a phrasal
  verb, idiom or fixed expression, even split ones like "turned the offer down"), then shows the
  headword and part of speech, the meaning in this sentence in simple English plus the usual
  equivalent in your language, "Good to know" notes only when needed, the sentence with the unit in
  bold, its translation blurred until clicked, two examples, "Common combinations" only for words with
  strong partners, other meanings collapsed, and ★ Save. The translation is the usual equivalent, with
  a few words of clarification when a single word would mislead, for example because it has several
  meanings.
```

4. In the **Translation card** bullet, replace `a natural Arabic translation` with `a natural translation into your language`.

5. Directly after the **Translation card** bullet, add:

```markdown
- **Language and level.** The Reading section of the settings page sets the translation language (40
  languages, any other by typing its name, or English only) and your English level (Intermediate B1,
  Upper-intermediate B2, Advanced C1). The level changes how simply cards explain and how much they
  explain. With English only, cards drop the translations, and a sentence card always gives a plainer
  English version instead. A new install starts with the browser's language.
```

6. In the **Saved items** bullet, replace `search in English or Arabic` with `search`, and add at the end of the bullet: `Each item keeps the language it was saved in.`

7. In the project layout section, add `languages.ts` (the translation languages) and `storage/migrate.ts` (converting old saved words; the install and update step) next to their neighbours, and rename `Arabic` to `Translated` where the components are listed.

- [ ] **Step 3: Update `docs/PLAN.md`**

1. In the decisions table, replace `Keeps requests and Arabic output bounded.` with `Keeps requests and translated output bounded.`

2. In the project structure block:
   - Replace `storage/{settings,cache,saved,url,hash}.ts` with `storage/{settings,cache,saved,migrate,url,hash}.ts`.
   - Add above the `speech.ts` line: `  languages.ts           the translation languages and everything derived from a language id`
   - In the `card/` line, add `title` after `TriggerIcon`.
   - In the `components/` line, replace `Arabic` with `Translated`.

3. In the data model section, replace the three lines for `DictionaryCard`, `TranslationCard` and `Summary` with:

```markdown
- `DictionaryCard { language, headword, partOfSpeech, unitIndices, meaning, translation?, notes[], sentenceTranslation?, examples[], combinations[], otherMeanings[{meaning, translation?}] }`
- `TranslationCard { language, translation?, plainEnglish, keyExpressions[{expression, indices, meaning, translation?}] }`
- `Summary { language, english, translation? }`, `SavedItem { id, kind, card, selection, sentence, sentenceSegments, pageTitle, url, savedAt }`
- `language` is a language id from `src/lib/languages.ts`: `none` (English only, no translation fields), a listed code such as `ar`, or `x:<name>` for a typed language. `Prefs { theme, language, level }` holds the reader's choice; `level` is `B1`, `B2` or `C1`.
```

4. In the storage keys line, replace `` `prefs` `` with `` `prefs` (theme, translation language, level) ``, and where it describes the caches, note that a card key includes the language and level and a summary key includes the language.

5. In "Prompt + validation rules":
   - Replace `Arabic = usual equivalent` with `translation = usual equivalent in the reader's language`.
   - Replace `Arabic script present` with `translation fields present and, for a language with its own script, written in it (none for English only)`.
   - Add a sentence: `The prompts are built for a reader: dictionarySystem(reader) and translationSystem(reader) take the language and level, summarySystem(language) takes the language. The worked examples show the English fields only.`

6. In the prompt history table, add a row for version 13 with the two-line note from Task 10, in this form:

```markdown
| 13 | Language and level come from settings; worked examples show English fields only | (what the live checks in Arabic, Spanish, Chinese, Persian and English only showed) |
```

Replace the text in brackets with the note. Do not leave the brackets in.

- [ ] **Step 4: Run everything**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all pass.

Run: `grep -n -i "arabic" README.md docs/PLAN.md`
Expected: only the prompt history rows that describe earlier versions, and the note that existing installs stay on Arabic if one was added.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/PLAN.md package.json wxt.config.ts
git commit -m "Describe the language and level settings in the docs and raise the version to 0.2.0"
```

- [ ] **Step 6: Hand over for a check in Chrome**

Tell the user the branch is ready and ask them to check it in their own Chrome, because the agent cannot drive an installed extension:

1. Run `pnpm build`, open `chrome://extensions`, and reload the unpacked Siyaq from `.output/chrome-mv3`.
2. Settings shows Reading at the top with العربية · Arabic and Advanced (C1): the existing install kept its behaviour.
3. My words still lists the saved words, in Arabic.
4. Look up a word on an article: an Arabic card as before.
5. Change the language to another one, look up the same word: the card is in that language.
6. Change to English only: no translation lines; a sentence gives an "Explanation" card.

Then say that the store materials are the next plan.
