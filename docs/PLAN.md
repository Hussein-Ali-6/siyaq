# Siyaq (سياق) — context-aware dictionary & translation extension

Plan written 2026-10-16 before implementation. Kept up to date as the architecture doc.

## Decisions (including where I departed from the brief)

| Topic | Decision | Why |
|---|---|---|
| Toolchain | **WXT** (not Vite + CRXJS) | WXT generates the MV3 manifest from entrypoints, has first-class content-script/shadow-DOM support and HMR, and is actively maintained; CRXJS has had long maintenance gaps. |
| API client | Official `@anthropic-ai/sdk` in the service worker, `messages.create()` + **own zod validation** (never `messages.parse()`) | Typed errors, timeouts and transport retries for free; `parse()` would throw on constraint mismatches and skip the app-level retry. |
| Model/params | `claude-sonnet-5-5`, `output_config: { effort: "low", format: json_schema }`, adaptive thinking left on (Sonnet 5.5 rejects `disabled`; at `low` it rarely thinks) | Matches the brief; structured outputs are GA. |
| Refusal fallback | `fallbacks: "default"` with beta `server-side-fallback-2026-07-01` | A safety-classifier decline (e.g. an article about malware) gets re-run server-side instead of showing an error. One constant to switch off. |
| Caching | Two cache breakpoints: static system prompt, then a per-page "article context" block (title, site, summary) | Same-page lookups re-use both; the 512-token minimum is cleared by the system prompt. |
| Numbered tokens | Sent for **both** card kinds. For sentences the selection itself is numbered, so key expressions come back with word indices | Lets us verify each key expression, highlight it, and open its dictionary card without fuzzy string matching. |
| Selection highlight | When the card opens the native selection is dropped and replaced by a CSS Custom Highlight on the selected words; it moves to the unit's words when the answer arrives | One unambiguous highlight instead of two overlapping ones. |
| Selection size | Translation selections capped at 400 words (card explains) | Keeps requests and Arabic output bounded. |
| Cache key | sha-256 of prompt version + kind + normalised URL + paragraph + selection + selected indices | Includes which occurrence was selected, so a word repeated in one paragraph with two senses is not confused. |
| Key secrecy | Key lives in `chrome.storage.local`; only the service worker and the options page touch it; the content script never calls `chrome.storage`. The worker also tries `storage.local.setAccessLevel('TRUSTED_CONTEXTS')` (Chrome 130+) which locks content scripts out of local storage entirely | Belt and braces. |
| Logging | `log.ts` accepts an event code and numeric/boolean fields only | Page text and answers can never reach the console. |
| Name | "Siyaq" (سياق = context) | Easy to rename later in `wxt.config.ts`. |

## Project structure

```
wxt.config.ts            manifest + Vite plugins (React, Tailwind v4)
vitest.config.ts         node env; DOM tests opt in with // @vitest-environment jsdom
src/entrypoints/
  background.ts          service worker: message handlers, Claude calls, caches, saved items
  content/index.ts       selection watcher, icon, card host, highlight, article extraction
  content/style.css      Tailwind + theme, injected into the shadow root as inline text
  popup/                 toolbar popup (key status, page summary, links)
  options/               API key, theme, cache controls (opens in a tab)
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
  dom/article.ts         Readability extraction, 6,000-word cap
  claude/client.ts       SDK client, structured call with timeout + error mapping
  claude/prompts.ts      system prompts (with worked examples) and user-message builders
  claude/schemas.ts      loose JSON schemas sent to the API
  claude/validate.ts     strict zod validation, list trimming, index checks
  claude/lookup.ts       cache -> prompt -> call -> validate -> one retry -> cache
  claude/summary.ts      article summary pipeline
  storage/{settings,cache,saved,url,hash}.ts
  log.ts
src/ui/
  theme.css              colour tokens (dark default, amber accent), font stacks, RTL helpers
  card/                  CardApp + DictionaryCard, TranslationCard, SummaryView, Skeleton, ErrorView
  components/            small shared pieces (Button, Chip, BlurReveal, Collapsible)
playground/              Vite page that mounts the real card in a shadow root with fixtures (visual QA)
scripts/eval/            live evaluation harness: 3 articles x ~30 selections, dry-run or live
```

## Manifest (generated by WXT)

- `permissions`: `storage` (key, caches, saved items), `activeTab` (popup needs the active tab's URL and to message its content script).
- `host_permissions`: `https://api.anthropic.com/*` (worker fetches the API; no CORS preflight issues).
- `content_scripts`: `http://*/*`, `https://*/*`, top frame only, `document_idle`.
- `action.default_popup`: popup. `options_ui`: options page, `open_in_tab: true`.
- Unlisted page `words.html` (My words). Background is a module service worker.
- No `tabs`, no `scripting`, no `unlimitedStorage`, nothing synced.

## Message flow (all via `chrome.runtime.sendMessage`, typed)

```
content ──lookup(LookupRequest)──────────────▶ worker ──▶ cache? ──▶ Claude ──▶ validate (retry once) ──▶ cache
        ◀─LookupResponse {ok, card | error}──┘
content ──getSummary(url)───────────────────▶ worker (summary cache)
content ──summarize({url,title,site,text})──▶ worker ──▶ in-flight dedupe ──▶ Claude ──▶ cache per URL
content ──saveItem / unsaveItem / isSaved───▶ worker (chrome.storage.local "saved")
content ──getPrefs──────────────────────────▶ worker (theme)
popup   ──getStatus / getSummary────────────▶ worker
popup   ──extractArticle (to active tab)────▶ content (Readability) ──▶ popup ──summarize──▶ worker
options ──testApiKey / clearCache───────────▶ worker;  options writes apiKey/theme to storage directly
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
- Storage keys: `apiKey`, `prefs`, `saved` (array), `cache:<sha>` (LRU-trimmed to 400), `summary:<sha(url)>` (trimmed to 100).

## Prompt + validation rules

Encoded verbatim from the brief in `prompts.ts` (meaning = general B1 definition, Arabic = usual equivalent,
notes default empty with the five allowed reasons, combinations only for strong partners, worked examples
with empty lists). API schema has no enums/min/max; `validate.ts` enforces: Arabic script present, 1–2
examples, ≤2 notes, ≤6 combinations, ≤4 other meanings, ≤3 key expressions (trim, not reject), indices
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

## Build order

1. Scaffold (pnpm, WXT, React, Tailwind, vitest) and verify a build.
2. TDD the pure modules: tokens, words, blocks/flat (jsdom), validate, cache key/url.
3. Claude layer: client, prompts, schemas, lookup/summary orchestration (unit-tested with a fake client).
4. Worker + messaging + storage.
5. Card UI + content script (selection, icon, highlight, positioning), playground for visual checks.
6. Popup, options, My words.
7. Eval harness (dry run here; live run needs the user's key), README, commits.
