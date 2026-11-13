# Translation language and reading level settings

Date: 13 November 2026. Status: design agreed, not built.

## Goal

Siyaq is for anyone learning English, whatever their first language. Today Arabic is built into the
prompts, the data fields, the validation and the screens. This change makes the translation language
a setting, adds a reading-level setting, and rewrites the store materials and docs to match.

## What the reader sees

### Settings

A new **Reading** section sits at the top of the settings page, above **AI provider**.

- **Translate into**: one list.
  - First entry: **English only (no translation)**.
  - Then 40 languages, each shown as its own name followed by its English name
    (for example "العربية · Arabic"), sorted by English name.
  - Last entry: **Other…**, which shows a text box for the language name in English
    (for example "Kurdish"). The choice is saved once the box holds a name.
- **My English level**: three choices.
  - **Intermediate (B1)**
  - **Upper-intermediate (B2)**
  - **Advanced (C1)**
- A line below both: "These apply to new lookups. Saved words keep the language they were saved in."

Defaults:

| Case | Language | Level |
|---|---|---|
| New install, browser language is in the list | That language | Upper-intermediate |
| New install, browser language is English or not in the list | English only | Upper-intermediate |
| Existing install being updated | Arabic | Advanced |

### Cards

- Cards keep their layout. Every translation is in the chosen language, with the right text
  direction and font.
- **English only**, word card: the translation line, the sentence translation and the translations
  of other meanings are not shown.
- **English only**, sentence card: titled **Explanation** instead of **Translation**. It always
  gives the selection in plainer English, plus key expressions with English meanings.
- **English only**, summary: the English summary alone.
- The level changes what a card explains (see "Level guidance").

### My words

- Each saved item keeps the language it was saved in and is shown in that language.
- When the list holds more than one language, each item shows its language name in its muted
  details line. With one language nothing changes.
- The search box placeholder becomes "Search your words…".

### Unchanged

- Siyaq's own labels and messages stay in English.
- Only English text is looked up.
- The name Siyaq and the س mark stay.

## How it is built

### Language list: `src/lib/languages.ts`

The one place that knows about languages. No other file names a language.

```ts
export interface Language {
  id: string;            // BCP 47 code, also used as the HTML lang attribute
  nativeName: string;
  englishName: string;   // also the name used in prompts
  dir: 'ltr' | 'rtl';
  script?: string;       // Unicode script names, "|"-separated; absent means no script check
  variety?: string;      // the written standard to ask for, e.g. "Modern Standard Arabic"
}
```

A **language id** is a string used everywhere a language is stored:

- `none`: English only.
- A listed code, for example `ar` or `pt-BR`.
- `x:<name>`: a typed language, for example `x:Kurdish`. The name is trimmed, has its whitespace
  collapsed and control characters removed, and is cut at 40 characters.

Functions:

- `LANGUAGES`: the list below.
- `resolveLanguage(id)`: returns `{ id, label, promptName, dir, script?, variety? }`. A typed
  language has `dir: 'auto'` and no script. An unknown code is treated like a typed language.
  Not called with `none`.
- `otherLanguageId(name)`: builds an `x:` id from typed text, or returns `null` when it is empty.
- `languageFromBrowser(uiLanguage)`: the id for a new install. Exact match first, then the base
  language, with these special cases: `zh-TW`, `zh-HK` and `zh-Hant*` give `zh-Hant`; other `zh`
  gives `zh-Hans`; `pt-PT` gives `pt-PT`; other `pt` gives `pt-BR`; `no`, `nb` and `nn` give `nb`;
  `tl` and `fil` give `fil`. English and unlisted languages give `none`.

| id | Own name | English name | Direction | Script check |
|---|---|---|---|---|
| ar | العربية | Arabic | rtl | Arabic |
| bn | বাংলা | Bengali | ltr | Bengali |
| bg | Български | Bulgarian | ltr | Cyrillic |
| zh-Hans | 简体中文 | Chinese (Simplified) | ltr | Han |
| zh-Hant | 繁體中文 | Chinese (Traditional) | ltr | Han |
| cs | Čeština | Czech | ltr | none |
| da | Dansk | Danish | ltr | none |
| nl | Nederlands | Dutch | ltr | none |
| fil | Filipino | Filipino | ltr | none |
| fi | Suomi | Finnish | ltr | none |
| fr | Français | French | ltr | none |
| de | Deutsch | German | ltr | none |
| el | Ελληνικά | Greek | ltr | Greek |
| he | עברית | Hebrew | rtl | Hebrew |
| hi | हिन्दी | Hindi | ltr | Devanagari |
| hu | Magyar | Hungarian | ltr | none |
| id | Bahasa Indonesia | Indonesian | ltr | none |
| it | Italiano | Italian | ltr | none |
| ja | 日本語 | Japanese | ltr | Han, Hiragana, Katakana |
| ko | 한국어 | Korean | ltr | Hangul |
| ms | Bahasa Melayu | Malay | ltr | none |
| nb | Norsk | Norwegian | ltr | none |
| fa | فارسی | Persian | rtl | Arabic |
| pl | Polski | Polish | ltr | none |
| pt-BR | Português (Brasil) | Portuguese (Brazil) | ltr | none |
| pt-PT | Português (Portugal) | Portuguese (Portugal) | ltr | none |
| ro | Română | Romanian | ltr | none |
| ru | Русский | Russian | ltr | Cyrillic |
| sr | Српски | Serbian | ltr | none (written in two scripts) |
| sk | Slovenčina | Slovak | ltr | none |
| es | Español | Spanish | ltr | none |
| sw | Kiswahili | Swahili | ltr | none |
| sv | Svenska | Swedish | ltr | none |
| ta | தமிழ் | Tamil | ltr | Tamil |
| te | తెలుగు | Telugu | ltr | Telugu |
| th | ไทย | Thai | ltr | Thai |
| tr | Türkçe | Turkish | ltr | none |
| uk | Українська | Ukrainian | ltr | Cyrillic |
| ur | اردو | Urdu | rtl | Arabic |
| vi | Tiếng Việt | Vietnamese | ltr | none |

Only Arabic has a `variety` ("Modern Standard Arabic"), which keeps today's Arabic output.

### Settings data

`Prefs` in `src/lib/types.ts` gains two fields:

```ts
export type Level = 'B1' | 'B2' | 'C1';
export interface Prefs { theme: 'dark' | 'light'; language: string; level: Level; }
export const DEFAULT_PREFS: Prefs = { theme: 'dark', language: 'none', level: 'B2' };
```

`DEFAULT_PREFS` is only the fallback for a read that happens before the install step below has
run. The background worker reads the preferences for every lookup and summary and passes
`{ language, level }` on. The content script and the card never read them: a card carries its own
language.

### Card data

The fields lose their Arabic names, and every card and summary records its language.

| Today | After |
|---|---|
| `DictionaryCard.arabic` | `translation?` |
| `DictionaryCard.sentenceArabic` | `sentenceTranslation?` |
| `DictionaryCard.arabicMeaning?` (old saved cards only) | `translationNote?` |
| `OtherMeaning.arabic` | `translation?` |
| `KeyExpression.arabic` | `translation?` |
| `TranslationCard.arabic` | `translation?` |
| `Summary.arabic` | `translation?` |
| (new) | `language: string` on `DictionaryCard`, `TranslationCard` and `Summary` |

When `language` is `none` the translation fields are absent. For any other language they are
required, as today.

### Prompts: `src/lib/llm/prompts.ts`

The three constants become functions, and `PROMPT_VERSION` becomes 13.

```ts
export interface Reader { language: string; level: Level }
export function dictionarySystem(reader: Reader): string;
export function translationSystem(reader: Reader): string;
export function summarySystem(language: string): string;
```

- The opening line describes the reader from the settings, for example "a native speaker of Spanish
  who reads English at about B2 level". For English only: "a reader who wants explanations in
  English only".
- Field rules name the language through `promptName` and, where set, `variety`.
- The worked examples keep their English parts. Their Arabic answers are removed, and one line
  after the examples says the translation fields are still required and must be in the reader's
  language.
- English only uses its own, shorter answer format with no translation fields. In it, the sentence
  card's `plainEnglish` is required.
- Each function returns the same text for the same settings, so prompt caching works as before.
- The summary prompt does not depend on the level. It asks for plain English that suits all three.

`schemas.ts` gets the same treatment: `dictionarySchema(language)`, `translationSchema(language)`
and `summarySchema(language)` return the shape with or without the translation fields.

### Level guidance

One block of guidance per level, inserted into the dictionary and translation prompts. Advanced
keeps today's wording, which makes it the regression baseline.

| | Intermediate (B1) | Upper-intermediate (B2) | Advanced (C1) |
|---|---|---|---|
| Meaning | Very common words, short sentences | Simple defining words | As today |
| Examples | Short and simple | Everyday | As today |
| Notes | Also common confusions and basic usage | Also register and common confusions | Rare, as today |
| Key expressions | Any idiom, phrasal verb or less common word | Idioms and phrasal verbs a B2 reader may not know | Only what a C1 reader could misread, as today |
| Plainer English (sentence card) | Always | When it helps | When it helps, as today |

The exact wording is settled during the live checks.

### Validation: `src/lib/llm/validate.ts`

`validateDictionary`, `validateTranslation` and `validateSummary` take the language id and attach
it to the result. The translation fields are checked by one rule:

| Language | Rule |
|---|---|
| `none` | The fields are left out of the result, even if the model sent them |
| Listed, with a script | Not empty, and at least one character of that script |
| Listed without a script, or typed | Not empty |

A failed check triggers the existing single retry with the reason as a hint, then the existing
"unusable answer" error.

### Cache

- Card key: today's material plus the language id (lowercased) and the level.
- Summary key: `summary:<sha256(normalized URL + language id, lowercased)>`. The level is not part
  of it.
- `getSummary` and the in-flight map in `summary.ts` use the same language-aware key.
- A lookup uses the English summary stored for the current language as article context, as today.

### Update and install step

`runtime.onInstalled` in `src/entrypoints/background.ts` calls one new function,
`prepareStorage(reason, uiLanguage)` in `src/lib/storage/migrate.ts`:

1. If the stored preferences have no `language`:
   - `reason` is `update`: set Arabic and Advanced, and remove all cached cards and summaries.
   - `reason` is `install`: set `languageFromBrowser(uiLanguage)` and Upper-intermediate.
2. Write the saved list back after conversion.

Conversion is a pure function, `migrateSavedItem(item)`: a card without `language` gets its fields
renamed as in the table above and `language: 'ar'`. A card that has `language` is returned
unchanged, so running it twice is safe. `listSaved()` also applies it on every read, so no screen
ever sees the old shape.

### Display

- `src/ui/components/Arabic.tsx` becomes `Translated.tsx`. It takes a language id and sets `dir`
  (`rtl`, `ltr` or `auto`), `lang` (listed languages only) and `data-script`.
- `theme.css`: the `.arabic` rule becomes `.translated`, with `unicode-bidi: isolate` and
  `text-align: start`. The Arabic font stack, the larger size and the taller line height apply to
  `.translated[data-script="Arabic"]`, which covers Arabic, Persian and Urdu. Other languages use
  the interface font; the `lang` attribute lets the browser pick the right Chinese or Japanese
  glyphs.
- `DictionaryView`, `TranslationView`, `SummaryView`, the popup and the My words page use
  `Translated` with the card's own language and skip translation rows that are absent.
- The `font-arabic` class on the trigger icon stays, because the س mark is the logo.

### Saved words and export: `src/lib/storage/saved.ts`

- Search covers the renamed fields. The Arabic folding stays; it does nothing to other scripts.
- CSV header: `kind, headword, ipa_uk, ipa_us, translation, meaning, sentence,
  sentence_translation, language, page, url, saved`.
  - `translation` replaces `arabic`.
  - `sentence_translation` replaces the old `translation` column.
  - `language` holds the English name, the typed name, or "English only".
  - A sentence item leaves `translation` empty and puts its translation in `sentence_translation`.
- JSON export contains the cards as stored, including `language`.

### Evaluation script: `scripts/eval/run.ts`

Two new flags: `--language <id>` (default `ar`) and `--level <B1|B2|C1>` (default `C1`). The
defaults reproduce today's runs. Report file names include both.

## Error handling

- A typed language the model does not know: no special handling. The model does its best, and the
  reader can change the setting.
- "Other…" with an empty box: nothing is saved and the previous choice stays.
- A language id that is no longer in the list: treated as a typed language.
- A lookup that runs before the install step has finished: uses `DEFAULT_PREFS`.

## Testing

Tests are written before the code for each piece.

- `languages.ts`: every entry is complete and unique; `resolveLanguage` for listed, typed and
  unknown ids; `otherLanguageId` cleaning; `languageFromBrowser` including the special cases.
- Prompts: the language and level appear; no Arabic text remains; English only has no translation
  fields; the Advanced guidance matches today's wording; the same settings give the same text.
- Validation: each script rule accepts the right text and rejects English; Latin-script and typed
  languages need non-empty text; English only strips translation fields.
- Migration: an old word card, an old sentence card and an old card with `arabicMeaning` convert
  correctly; converting twice changes nothing; `prepareStorage` for install and for update.
- Cache keys: a different language or level gives a different card key; the summary key changes
  with the language and not with the level.
- Saved words: search over the new fields; the new CSV columns.
- The existing 202 tests are updated for the renamed fields and stay green.

Live checks with `pnpm eval --live`:

- A sample of about ten selections and one summary, run for Arabic, Spanish, Chinese (Simplified),
  Persian and English only.
- Intermediate against Advanced on the same sample for one language.
- The Arabic run is compared with the version-12 report. Its quality must not drop.
- Each batch spends API money, so each one needs a yes first.
- Only the Arabic output gets a native speaker's check. The store listing does not promise equal
  quality in every language.

## Order of work

On a branch named `language-setting`. Every step leaves the tests, the type check and the build
passing.

1. `languages.ts` and the two new preferences. No visible change.
2. Rename the card fields, record the language on each card, add the migration.
3. Prompts, schemas, validation and cache keys depend on language and level. Prompt version 13.
4. The Reading section, the `Translated` component, the English-only layouts, My words and CSV.
5. Live checks, then prompt adjustments from what they show.
6. Docs, store materials and version 0.2.0.

## Docs and store materials

- **Manifest and package description**: "Understand English words and sentences in context, with
  translation into your language, powered by the AI model you choose."
- **`store/listing.md`**: one English description for all English learners. The Arabic text stays
  as a localized listing with the same message.
- **Promo tile**: "English words and sentences, explained in your language, in context." The
  Arabic line is removed.
- **Screenshots**, recaptured from `playground/store/`. The Spanish and Chinese fixture text is
  taken from the live check output and then read through, not written by hand:

  | Screenshot | Shows |
  |---|---|
  | 1. Dictionary card | Spanish |
  | 2. Sentence translation | Arabic |
  | 3. Page summary | Chinese (Simplified) |
  | 4. My words | A mix of languages |
  | 5. Settings | The Reading section |

- **`store/privacy-practices.md` and `store/privacy-policy.md`**: one added line. The language and
  level are stored on the device, and the language name is sent to the AI provider with each
  request.
- **`README.md` and `docs/PLAN.md`**: updated for the settings, the field names and the new files.

## Not included

- Translating Siyaq's own labels.
- Looking up text that is not English.
- Translating words that are already saved into a newly chosen language.
- Store listings in more languages than English and Arabic.

## Open before the store submission, outside this change

- Sign in with ChatGPT in the store version: open-source the repository or remove it.
- The OpenRouter `appUrl` in `src/lib/llm/aisdk.ts` points at an address that is not this project.
- A public address and a contact email for the privacy policy.
