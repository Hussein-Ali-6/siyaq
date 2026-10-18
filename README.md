# Siyaq

A Chrome extension that replaces Google Translate for reading English articles: a context-aware
dictionary and translator for a native Arabic speaker (CEFR C1), powered by Claude. Select a word or
a sentence, click the small icon, and get a card that was written after reading the paragraph and
the article, not just the word.

## How it works

- **Trigger.** Selecting text (a double-click selects a word) shows a small round س button next to
  the selection. Nothing is sent anywhere until you click it. The icon never appears in inputs,
  textareas or editable areas.
- **Dictionary card** (up to 4 words): Claude decides the unit you mean (a word, or part of a phrasal
  verb, idiom or fixed expression, even split ones like "turned the offer down"), then shows the
  headword and part of speech, the meaning in this sentence in simple English plus the usual Arabic
  equivalent, "Good to know" notes only when needed, the sentence with the unit in bold, its Arabic
  translation blurred until clicked, two examples, "Common combinations" only for words with strong
  partners, other meanings collapsed, and ★ Save. The Arabic is the usual equivalent, with a few words of
  clarification when a single Arabic word would mislead, for example because it has several meanings.
- **Translation card** (a sentence or longer): a natural Arabic translation, plainer English only when
  the original is hard, and at most three "Key expressions" that open their own dictionary card.
- **Context sent with every request:** page title and site, the article summary once it exists, the
  paragraph around the selection widened to 150–400 words, and the selection as numbered word tokens
  (`[12]gave [13]up`) so Claude's answer can be checked and the exact words highlighted on the page.
- **Article summary.** The first card opened on a page starts a summary in the background
  (Mozilla Readability, capped at 6,000 words). It is cached per URL, sent as context with later
  requests, and shown by the book button in the card header and in the toolbar popup.
- **Saved items** live in `chrome.storage.local`. The "My words" page lists them newest first, with
  search in English or Arabic, a link back to the source sentence, delete, and JSON/CSV export.
- **Cache.** Answers are cached by URL, paragraph and selection, so asking again costs nothing.

## Setup

```bash
pnpm install
pnpm build          # -> .output/chrome-mv3
```

Load it in Chrome: open `chrome://extensions`, enable *Developer mode*, choose *Load unpacked* and
pick `.output/chrome-mv3`. The settings page opens on first install: paste your Anthropic API key and
press *Save and test*. The key is stored in `chrome.storage.local` (never synced) and only the
service worker reads it. Pages that were already open need a reload before the icon appears.

For development, `pnpm dev` starts WXT with hot reload (it opens its own Chrome profile).

## Project layout

```
src/entrypoints/background.ts   service worker: Claude calls, caches, saved items, key test
src/entrypoints/content/        selection watcher, trigger icon, card host, highlight, extraction
src/entrypoints/popup|options|words   extension pages (React + Tailwind v4)
src/lib/text                    sentence/word segmentation, numbered passages, index checks
src/lib/dom                     paragraph widening, flat text model, selection, highlight, article
src/lib/claude                  SDK client, prompts, loose API schemas, strict validation, lookup/summary
src/lib/storage                 settings, caches, saved items, URL normalisation, hashing
src/ui                          theme, card components, shared pieces
playground/                     visual playground for the card (pnpm playground)
scripts/eval/                   live prompt evaluation on real articles
docs/PLAN.md                    architecture and decisions
```

## Checks

```bash
pnpm test        # vitest: tokens, paragraph/context building, index mapping, validators, storage, lookup
pnpm typecheck
pnpm build
pnpm playground  # http://localhost:5178, scenario buttons top right
```

## Evaluating the prompts

`scripts/eval/cases.json` lists 33 selections from three real articles (ordinary words, phrasal
verbs, idioms, names, technical terms, long sentences), each with what we expect: no notes for
ordinary words, no combinations for idioms, the unit a dictionary would list.

```bash
pnpm eval                              # dry run: builds every request, prints the numbered passages
pnpm eval --live                       # calls Claude, writes scripts/eval/out/report.md
pnpm eval --live --only guardian       # one article
```

`--live` reads `ANTHROPIC_API_KEY` from the environment or from a `.env` file in the project root
(git-ignored). This key is only for the evaluation script: the extension itself uses the key saved
on its settings page.

The report shows every card and flags padding (notes on ordinary words, combinations for idioms,
retold meanings, plain English on clear sentences). Tune `src/lib/claude/prompts.ts`, bump
`PROMPT_VERSION` so cached answers are not reused, and run again.

## Privacy

Nothing leaves the browser until you click the icon. Each request sends the page title, the paragraph
around the selection, the selection, and the article summary (once it exists) to the Anthropic API with
your key. The console only ever shows event names, error codes, status codes and counts, never page
text or answers.
