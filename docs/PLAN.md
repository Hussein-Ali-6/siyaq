# Siyaq: context-aware dictionary and translation extension

Plan written 2026-10-16 before implementation. Kept up to date as the architecture doc.

## Decisions (including where I departed from the brief)

| Topic | Decision | Why |
|---|---|---|
| Toolchain | **WXT** (not Vite + CRXJS) | WXT generates the MV3 manifest from entrypoints, has first-class content-script/shadow-DOM support and HMR, and is actively maintained; CRXJS has had long maintenance gaps. |
| API client | Official `@anthropic-ai/sdk` in the service worker, `messages.create()` + **own zod validation** (never `messages.parse()`) | Typed errors, timeouts and transport retries for free; `parse()` would throw on constraint mismatches and skip the app-level retry. |
| Model/params | `claude-sonnet-5-5`, `output_config: { effort: "medium", format: json_schema }`, adaptive thinking left on | Started at low as briefed; moved to medium on 2026-10-18 at the user's choice. Lookups still take 3 to 4 seconds. |
| Refusal fallback | `fallbacks: "default"` with beta `server-side-fallback-2026-07-01` | A safety-classifier decline (e.g. an article about malware) gets re-run server-side instead of showing an error. One constant to switch off. |
| Caching | Two cache breakpoints: static system prompt, then a per-page "article context" block (title, site, summary) | Same-page lookups re-use both; the 512-token minimum is cleared by the system prompt. |
| Numbered tokens | Sent for **both** card kinds. For sentences the selection itself is numbered, so key expressions come back with word indices | Lets us verify each key expression, highlight it, and open its dictionary card without fuzzy string matching. |
| Selection highlight | When the card opens the native selection is dropped and replaced by a CSS Custom Highlight on the selected words; it moves to the unit's words when the answer arrives | One unambiguous highlight instead of two overlapping ones. |
| Selection size | Translation selections capped at 400 words (card explains) | Keeps requests and translated output bounded. |
| Cache key | sha-256 of prompt version + provider and model + translation language + level + kind + normalised URL + paragraph + selection + numbered passage + selected indices | Includes which occurrence was selected, so a word repeated in one paragraph with two senses is not confused. Includes the language and the level, so changing either never reuses an answer written for another reader. |
| Key secrecy | Key lives in `chrome.storage.local`; only the service worker and the options page touch it; the content script never calls `chrome.storage`. The worker also tries `storage.local.setAccessLevel('TRUSTED_CONTEXTS')` (Chrome 130+) which locks content scripts out of local storage entirely | Belt and braces. |
| Logging | `log.ts` accepts an event code and numeric/boolean fields only | Page text and answers can never reach the console. |
| Providers (2026-10-20) | Anthropic on its official SDK; OpenAI, Gemini and OpenRouter through the AI SDK (`ai` 7 with `@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`); ChatGPT plan through a hand-built Responses request | The Anthropic path keeps prompt caching, effort and refusal fallback. The ChatGPT route accepts only some fields (store false, stream true, no max_output_tokens), so it is not left to a library. All providers share one `LlmClient` interface, so prompts, validation, retry and cache are unchanged. |
| Permissions for providers | `host_permissions` keeps only Anthropic; the others are `optional_host_permissions`, plus optional `tabs` for ChatGPT sign-in | Users grant only the provider they use. |
| ChatGPT sign-in | OpenAI's direct flow for open-source apps, loopback redirect read from the sign-in tab, paste fallback | The documented redirect is `http://127.0.0.1:<port>/auth/callback` only, and an extension cannot listen there. |
| Pronunciation | Reversed the brief's "no pronunciation" on 2026-10-18: British and American IPA from the model, speech through the browser's own speech synthesis (Chrome's Google voices, system voices elsewhere), YouGlish and Oxford Learner's links | Google Translate's audio URL is unofficial and would need another host permission; the speech API is supported and needs none. |
| Name | "Siyaq", written only in English in the UI and icons | Easy to rename later in `wxt.config.ts`. |

## Project structure

```
wxt.config.ts            manifest + Vite plugins (React, Tailwind v4)
vitest.config.ts         node env; DOM tests opt in with // @vitest-environment jsdom
src/entrypoints/
  background.ts          service worker: message handlers, model calls, caches, saved items, provider tests, model lists
  content/index.ts       content script entry (top frame only)
  content/controller.ts  selection watcher, icon, card host, highlight, article extraction
  content/style.css      Tailwind + theme, injected into the shadow root as inline text
  popup/                 toolbar popup (provider status, page summary, links)
  options/               setup card for a new install, language and level, providers as rows (one Connect button for a key, ChatGPT sign-in, model, thinking), theme, stored answers, privacy (opens in a tab)
  words/                 "My words" page (search, open source, delete, export)
src/lib/
  types.ts               shared data types (requests, cards, saved items, summary)
  messaging.ts           typed protocol (@webext-core/messaging)
  text/tokens.ts         sentence/word segmentation, numbered passage, index checks
  text/words.ts          word counting, selection classification
  text/punctuation.ts    full-width punctuation for Chinese translations
  dom/blocks.ts          block ancestor, text-block collection, paragraph widening (150–400 words)
  dom/flat.ts            flat text model of a block; DOM Range <-> offsets
  dom/selection.ts       reads the selection, builds a LookupRequest
  dom/highlight.ts       CSS Custom Highlight API wrapper
  dom/article.ts         Readability extraction, 4,000-word cap (was 6,000 until 2026-10-18)
  llm/types.ts           shared LlmClient interface, provider ids, thinking levels, timeout, errors
  llm/providers.ts       the provider list shown in settings
  llm/anthropic.ts       Anthropic SDK client: prompt caching, effort, refusal fallback, error mapping
  llm/aisdk.ts           OpenAI, Gemini and OpenRouter through the AI SDK
  llm/chatgpt.ts         hand-built Responses request for a ChatGPT plan
  llm/resolve.ts         client for the active provider, falling back to a ready one
  llm/catalog.ts         live model list per provider
  llm/models.ts          model list clean-up and the recommended default
  llm/prompts.ts         system prompts (with worked examples) and user-message builders
  llm/schemas.ts         loose JSON schemas sent to the API
  llm/validate.ts        strict zod validation, list trimming, index checks
  llm/lookup.ts          cache -> prompt -> call -> validate -> one retry -> cache
  llm/summary.ts         article summary pipeline
  auth/chatgpt-oauth.ts  Sign in with ChatGPT: OAuth with PKCE, loopback redirect, token refresh
  storage/{settings,cache,saved,migrate,url,hash}.ts
  languages.ts           the translation languages and everything derived from a language id
  speech.ts              read-aloud through the browser's speech synthesis
  links.ts               YouGlish and Oxford Learner's links
  log.ts
src/ui/
  theme.css              colour tokens (dark default, amber accent), font stacks, RTL helpers
  card/                  CardApp, CardFrame, DictionaryView, TranslationView, SummaryView, LoadingView, ErrorView, TriggerIcon, title
  components/            small shared pieces (Translated, BlurReveal, Collapsible, Pronunciation, SpeakButton, LookupLinks, Skeleton)
playground/              Vite page that mounts the real card in a shadow root with fixtures (visual QA)
scripts/eval/            live evaluation harness: 3 articles x ~30 selections, dry-run or live
```

## Manifest (generated by WXT)

- `permissions`: `storage` (keys, caches, saved items), `activeTab` (popup needs the active tab's URL and to message its content script).
- `host_permissions`: `https://api.anthropic.com/*` (worker fetches the API; no CORS preflight issues).
- `optional_host_permissions`: OpenAI (API and sign-in), Gemini and OpenRouter, each requested when the reader turns that provider on.
- `optional_permissions`: `tabs`, requested only for Sign in with ChatGPT, to read the sign-in tab's redirect.
- `content_scripts`: `http://*/*`, `https://*/*`, top frame only, `document_idle`.
- `action.default_popup`: popup. `options_ui`: options page, `open_in_tab: true`.
- Unlisted page `words.html` (My words). Background is a module service worker.
- No required `tabs`, no `scripting`, no `unlimitedStorage`, nothing synced.

## Message flow (all via `chrome.runtime.sendMessage`, typed)

```
content ──lookup(LookupRequest)──────────────▶ worker ──▶ cache? ──▶ model ──▶ validate (retry once) ──▶ cache
        ◀─LookupResponse {ok, card | error}──┘
content ──getSummary(url)───────────────────▶ worker (summary cache)
content ──summarize({url,title,site,text})──▶ worker ──▶ in-flight dedupe ──▶ model ──▶ cache per URL and language
content ──saveItem / unsaveItem / isSaved───▶ worker (chrome.storage.local "saved")
content ──getPrefs──────────────────────────▶ worker (theme)
popup   ──getStatus / getSummary────────────▶ worker
popup   ──extractArticle (to active tab)────▶ content (Readability) ──▶ popup ──summarize──▶ worker
options ──testProvider / listModels─────────▶ worker
options ──clearCaches───────────────────────▶ worker;  options writes keys, provider settings, ChatGPT sign-in, theme, translation language and level to storage directly
words   ── reads/deletes/exports "saved" directly (extension page, trusted context)
```

Sequence for a lookup: mouseup → selection valid & not editable → icon shown. Click → content builds the
request (paragraph widening + numbered passage) → card opens in loading state with the selected text →
`lookup` sent. In parallel, once per page: `getSummary`; if missing, Readability runs and `summarize` is
sent (not awaited by the card). Answer → strict validation already done in the worker → content maps unit
indices to DOM ranges → highlight → card renders.

## Data model

- `LookupRequest { kind, page{url,title,siteName}, paragraph, selection, passage: Token[], selectedIndices, sentenceSpan? }`
- `DictionaryCard { language, headword, partOfSpeech, unitIndices, meaning, translation?, notes[], sentenceTranslation?, examples[], combinations[], otherMeanings[{meaning, translation?}] }`
- `TranslationCard { language, translation?, plainEnglish, keyExpressions[{expression, indices, meaning, translation?}] }`
- `Summary { language, english, translation? }`, `SavedItem { id, kind, card, selection, sentence, sentenceSegments, pageTitle, url, savedAt }`
- `language` is a language id from `src/lib/languages.ts`: `none` (English only, no translation fields), a listed code such as `ar`, or `x:<name>` for a typed language. `Prefs { theme, language, level }` holds the reader's choice; `level` is `B1`, `B2` or `C1`.
- Storage keys: `apiKey` (Anthropic) and `apiKey:<provider>` (the others), `activeProvider`, `providerSettings` (model and thinking per provider), `chatgpt` (sign-in tokens), `chatgptLastAttempt` (last sign-in step, for error messages), `prefs` (theme, translation language, level), `saved` (array), `cache:<sha>` (LRU-trimmed to 400; a card key includes the language and level), `summary:<sha(url)>` (trimmed to 100; the key includes the language).

## Install and update step (0.2.0)

Versions before 0.2.0 translated into Arabic for an advanced reader and stored no language. On
`runtime.onInstalled` the worker runs `prepareStorageWithRetry` from `storage/migrate.ts`, which looks
at what is stored and at the version the update came from:

- **New install.** Stores the browser's interface language when the list has it (`languageFromBrowser`),
  otherwise English only, with level B2. The settings page opens once the step has finished.
- **Update from before 0.2.0** (no language stored, and `previousVersion` below 0.2.0 or missing). Stores
  Arabic and C1, keeps the theme, and clears the card and summary caches, whose entries have the old
  shape. The caches go first, so a retry still clears them.
- **Update from 0.2.0 or later with no language stored** (an earlier run of the step failed). Treated like
  a new install; nothing is cleared. Versions are compared by their numbers, so 0.10.0 is later than 0.2.0.
- **A language is already stored.** The settings and the caches are left alone.
- **Saved words**, in every case: items in the old shape are rewritten once (`migrateSavedItem` renames
  the Arabic fields to `translation`, `translationNote` and `sentenceTranslation` and sets
  `language: 'ar'`). `saved.ts` also converts on every read, so My words is right even if the step failed.

The step is safe to run twice. It is tried once more if it fails and it never rejects: after two failures
the worker logs `prepare_storage_failed` and reads fall back to `DEFAULT_PREFS` (English only, B2). The
handlers that read the preferences (`lookup`, `getSummary`, `summarize`, `getPrefs`) wait for the step
first, through `storageReady` in `background.ts`. The browser language is read inside the step, and only
when a starting language has to be chosen. `getPrefs` goes through `prefsFromStored`, which replaces a
stored level or language that is not usable with the default.

## Prompt + validation rules

Encoded verbatim from the brief in `prompts.ts` (meaning = general B1 definition, translation = usual equivalent in the reader's language,
notes default empty with the five allowed reasons, combinations only for strong partners, worked examples
with empty lists). API schema has no enums/min/max; `validate.ts` enforces: translation fields present and, for a language with its own script, written in it (none for English only), 1–2
examples, no cap on notes (the model decides, since 2026-10-18), ≤6 combinations, ≤4 other meanings, ≤3 key expressions (trim, not reject), indices
unique, in range and overlapping the selection (reject → retry once with the reason appended). For a language marked `fullWidthPunctuation` in `languages.ts` (the two kinds of Chinese), every accepted translation field has a half-width `, ; : ? ! ( )` next to a Chinese character turned into its full-width mark, with the spaces around it dropped; marks between digits or Latin letters stay.
The prompts are built for a reader: dictionarySystem(reader) and translationSystem(reader) take the language and level, summarySystem(language) takes the language. The worked examples show the English fields only.
After the examples, the dictionary and sentence prompts say that the translation fields are still required, written in the reader's language with the punctuation that language uses in print; the summary prompt asks for the same punctuation. Inside a prompt a language goes by its `promptName` from `languages.ts`, which is the English name except for the four entries whose list name has brackets ("Simplified Chinese", not "Chinese (Simplified)"). The settings list keeps the list name, and so do the CSV export and the evaluation report, through `languageName`.

## Learned while building (2026-10-16)

- Pages like paulgraham.com separate paragraphs with `<br><br>` inside one block. The flat text model
  now treats `<br>` as a newline (mapped back to a DOM position), block text turns it into a space, and
  when the containing block is still over 400 words the "paragraph" becomes a window of whole sentences
  around the selection (150–400 words). Readability output goes through the same break-preserving walk.
- Footnote markers like `[2]` on Wikipedia and essays are skipped by the tokenizer so they cannot be
  mistaken for the `[i]word` numbering.
- Tailwind v4 only scans from the Vite root; `@source "../"` in the theme makes the playground and the
  extension generate the same utilities.
- `@vitejs/plugin-react` 6 needs Vite 8; the project pins v5 through a pnpm override with Vite 7.
- Tailwind's internal variables get their defaults from `@property`, which Chrome ignores inside a
  shadow root, so the card's borders and shadow vanished. `withShadowPropertyDefaults` copies those
  defaults onto the shadow tree inside Tailwind's `properties` layer.

## Live evaluation (2026-10-18)

33 selections from three articles plus three summaries, checked automatically and read by hand.

| Prompt version | Flagged cases | Word cards with a note |
|---|---|---|
| 1 | about 11 of 36 (re-scored by hand against the final checks) | 15 of 29 |
| 2 | 5 of 36 | 8 of 29 |
| 3 | 6 of 36 | 7 of 29 |
| 4 (shipped) | 5 of 36 | 6 of 29 |

Fixed by tuning: pronunciation and grammar notes, notes restating the meaning, trivia about names,
over-wide units ("military junta", "a tincture of"), literal metaphors ("rudder"), Arabic fields that
translated neighbouring words or carried brackets, summaries over 150 words. Multi-word headwords never
get combinations (enforced in `validate.ts`).

Still borderline after four rounds, and varying run to run at effort low: a usage note on "chilling
effect", a history note on "ticker-tape parade", free pairings listed for "nonsensical", and "turn out
to be" or "match" listed as key expressions. Further prompt rounds stopped helping; raising effort is the
remaining lever.

## Prompt style after user testing (2026-10-18)

The user asked for looser prompts that let the model decide, one Arabic field that adds detail only when
needed, grammar notes allowed, notes on roughly a third of cards, and medium effort. Measured on small
samples to limit cost:

| Version | What changed | Result |
|---|---|---|
| 5 | Fully loose, separate Arabic explanation field | Notes on 25 of 28 word cards, widened units, padded key expressions |
| 6 to 8 | Purpose sentences, "most cards have none", a short list | Notes on 15 to 22 of 28 |
| 9 | One Arabic field, grammar allowed, medium effort | Notes on all 9 of a note-prone sample, widened units |
| 10 (shipped) | Notes opt-in with grammar as an allowed reason, two unit examples | Notes on 7 of 9 note-prone words and 1 of 6 everyday words, units right |
| 13 | Language and level come from settings; worked examples show English fields only | Live checks on 12 selections and the summary of one article, in Arabic, Spanish, Simplified Chinese, Persian and English only at C1, and Spanish at B1: every answer was usable, translations came in the right language and script, English only had no translation fields, and B1 was simpler than C1. Arabic matched version 12 on the same sample, except that verbs came in the present form (يكتشف) where version 12 gave the past (اكتشف); the reader accepted that. Chinese came back with half-width commas and colons, so the prompts now ask for the language's own punctuation. Six more calls for the store screenshots, in Spanish and Simplified Chinese at B2 (the first live run at that level), were all usable on the first attempt and came back in simplified characters under the prompt name "Simplified Chinese". They also showed that the punctuation line is not enough: half-width commas, semicolons and brackets still appeared in the Chinese summary and translations. So `validate.ts` now converts them for the two kinds of Chinese (`toFullWidthPunctuation` in `src/lib/text/punctuation.ts`). Japanese has not been run live and is not converted. |

Everything outside notes stays loose. Units and the Arabic field are guided by a sentence each.
Experimental prompts and reports are kept in `scripts/eval/out` (git-ignored).

## Build order

1. Scaffold (pnpm, WXT, React, Tailwind, vitest) and verify a build.
2. TDD the pure modules: tokens, words, blocks/flat (jsdom), validate, cache key/url.
3. Claude layer: client, prompts, schemas, lookup/summary orchestration (unit-tested with a fake client).
4. Worker + messaging + storage.
5. Card UI + content script (selection, icon, highlight, positioning), playground for visual checks.
6. Popup, options, My words.
7. Eval harness (dry run here; live run needs the user's key), README, commits.
