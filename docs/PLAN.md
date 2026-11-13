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
| Selection size | Translation selections capped at 400 words (card explains) | Keeps requests and Arabic output bounded. |
| Cache key | sha-256 of prompt version + kind + normalised URL + paragraph + selection + selected indices | Includes which occurrence was selected, so a word repeated in one paragraph with two senses is not confused. |
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
  options/               providers (key or ChatGPT sign-in, model, thinking), theme, cache controls (opens in a tab)
  words/                 "My words" page (search, open source, delete, export)
src/lib/
  types.ts               shared data types (requests, cards, saved items, summary)
  messaging.ts           typed protocol (@webext-core/messaging)
  text/tokens.ts         sentence/word segmentation, numbered passage, index checks
  text/words.ts          word counting, selection classification
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
  storage/{settings,cache,saved,url,hash}.ts
  speech.ts              read-aloud through the browser's speech synthesis
  links.ts               YouGlish and Oxford Learner's links
  log.ts
src/ui/
  theme.css              colour tokens (dark default, amber accent), font stacks, RTL helpers
  card/                  CardApp, CardFrame, DictionaryView, TranslationView, SummaryView, LoadingView, ErrorView, TriggerIcon
  components/            small shared pieces (Arabic, BlurReveal, Collapsible, Pronunciation, SpeakButton, LookupLinks, Skeleton)
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
content ──summarize({url,title,site,text})──▶ worker ──▶ in-flight dedupe ──▶ model ──▶ cache per URL
content ──saveItem / unsaveItem / isSaved───▶ worker (chrome.storage.local "saved")
content ──getPrefs──────────────────────────▶ worker (theme)
popup   ──getStatus / getSummary────────────▶ worker
popup   ──extractArticle (to active tab)────▶ content (Readability) ──▶ popup ──summarize──▶ worker
options ──testProvider / listModels─────────▶ worker
options ──clearCaches───────────────────────▶ worker;  options writes keys, provider settings, ChatGPT sign-in and theme to storage directly
words   ── reads/deletes/exports "saved" directly (extension page, trusted context)
```

Sequence for a lookup: mouseup → selection valid & not editable → icon shown. Click → content builds the
request (paragraph widening + numbered passage) → card opens in loading state with the selected text →
`lookup` sent. In parallel, once per page: `getSummary`; if missing, Readability runs and `summarize` is
sent (not awaited by the card). Answer → strict validation already done in the worker → content maps unit
indices to DOM ranges → highlight → card renders.

## Data model

- `LookupRequest { kind, page{url,title,siteName}, paragraph, selection, passage: Token[], selectedIndices, sentenceSpan? }`
- `DictionaryCard { headword, partOfSpeech, unitIndices, meaning, arabic, notes[], sentenceArabic, examples[], combinations[], otherMeanings[] }`
- `TranslationCard { arabic, plainEnglish, keyExpressions[{expression, indices, meaning, arabic}] }`
- `Summary { english, arabic }`, `SavedItem { id, kind, card, selection, sentence, sentenceSegments, pageTitle, url, savedAt }`
- Storage keys: `apiKey` (Anthropic) and `apiKey:<provider>` (the others), `activeProvider`, `providerSettings` (model and thinking per provider), `chatgpt` (sign-in tokens), `chatgptLastAttempt` (last sign-in step, for error messages), `prefs`, `saved` (array), `cache:<sha>` (LRU-trimmed to 400), `summary:<sha(url)>` (trimmed to 100).

## Prompt + validation rules

Encoded verbatim from the brief in `prompts.ts` (meaning = general B1 definition, Arabic = usual equivalent,
notes default empty with the five allowed reasons, combinations only for strong partners, worked examples
with empty lists). API schema has no enums/min/max; `validate.ts` enforces: Arabic script present, 1–2
examples, no cap on notes (the model decides, since 2026-10-18), ≤6 combinations, ≤4 other meanings, ≤3 key expressions (trim, not reject), indices
unique, in range and overlapping the selection (reject → retry once with the reason appended).

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
