# Siyaq

A Chrome extension that replaces Google Translate for reading English articles: a context-aware
dictionary and translator for a native Arabic speaker (CEFR C1). It works with Claude, GPT, Gemini,
any model on OpenRouter, or your ChatGPT plan through Sign in with ChatGPT. Select a word or
a sentence, click the small icon, and get a card that was written after reading the paragraph and
the article, not just the word.

## How it works

- **Trigger.** Selecting English text (a double-click selects a word) shows a small round س button next to
  the selection. Selections that are mostly Arabic, another script, or only numbers and symbols don't
  show it. Nothing is sent anywhere until you click it. The icon never appears in inputs,
  textareas or editable areas.
- **Dictionary card** (up to 4 words): Claude decides the unit you mean (a word, or part of a phrasal
  verb, idiom or fixed expression, even split ones like "turned the offer down"), then shows the
  headword and part of speech, the meaning in this sentence in simple English plus the usual Arabic
  equivalent, "Good to know" notes only when needed, the sentence with the unit in bold, its Arabic
  translation blurred until clicked, two examples, "Common combinations" only for words with strong
  partners, other meanings collapsed, and ★ Save. The Arabic is the usual equivalent, with a few words of
  clarification when a single Arabic word would mislead, for example because it has several meanings.
- **Pronunciation.** Word cards show British and American IPA, each with a speaker button that reads the
  word in Chrome's Google voices, plus links that open the word on YouGlish (real videos) and in Oxford
  Learner's Dictionaries. Translation cards have UK and US speakers for the selected text.
- **Translation card** (a sentence or longer): a natural Arabic translation, plainer English only when
  the original is hard, and at most three "Key expressions" that open their own dictionary card.
- **Context sent with every request:** page title and site, the article summary once it exists, the
  paragraph around the selection widened to 150–400 words, and the selection as numbered word tokens
  (`[12]gave [13]up`) so the model's answer can be checked and the exact words highlighted on the page.
- **Article summary.** The first card opened on a page starts a summary in the background
  (Mozilla Readability, capped at 4,000 words). It is cached per URL, sent as context with later
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
pick `.output/chrome-mv3`. The settings page opens on first install. Pick a provider, connect it,
choose a model and press *Use for lookups*. Pages that were already open need a reload before the
button appears.

## AI providers

| Provider | How you connect | Notes |
|---|---|---|
| Anthropic | API key | The default. The prompts were tuned on Claude Sonnet 5.5. Uses Anthropic's official SDK with prompt caching and refusal fallback. |
| OpenAI | API key | Through the AI SDK, Responses API with structured output. |
| Google Gemini | Google AI Studio key | Through the AI SDK. |
| OpenRouter | One key | Hundreds of models; the list only shows models that support structured output. |
| ChatGPT | Continue with ChatGPT | Uses the reader's ChatGPT plan instead of an API key, through OpenAI's Sign in with ChatGPT for open-source apps. |

- Model lists load live from each provider, with a recommended default, and any model ID can be typed.
- One thinking setting (low, medium, high) maps onto each provider's own reasoning or thinking control.
- Each provider's site permission is optional and requested only when it is turned on. Keys and sign-in
  tokens stay in `chrome.storage.local` (never synced), are readable only by the extension's own pages
  and worker, and are only sent to their own provider.
- Sign in with ChatGPT follows OpenAI's direct flow (OAuth with PKCE). OpenAI only redirects to
  `http://127.0.0.1:<port>/auth/callback`, which an extension cannot listen on, so Siyaq opens the
  sign-in in a tab and reads the redirect address from it. That needs Chrome's *tabs* permission,
  requested only when you sign in. If the tab cannot be read, the settings page lets you paste the
  address instead. The feature is a preview from OpenAI and is self-serve for free, open-source apps.

For development, `pnpm dev` starts WXT with hot reload (it opens its own Chrome profile).

## Project layout

```
src/entrypoints/background.ts   service worker: model calls, caches, saved items, provider test, model lists
src/entrypoints/content/        selection watcher, trigger icon, card host, highlight, extraction
src/entrypoints/popup|options|words   extension pages (React + Tailwind v4)
src/lib/text                    sentence/word segmentation, numbered passages, index checks
src/lib/dom                     paragraph widening, flat text model, selection, highlight, article
src/lib/llm                     provider clients, model lists, prompts, loose API schemas, strict validation, lookup/summary
src/lib/auth                    Sign in with ChatGPT (OAuth with PKCE)
src/lib/storage                 settings, provider keys, caches, saved items, URL normalisation, hashing
src/lib/speech.ts, links.ts     read-aloud, YouGlish and Oxford links
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
pnpm eval --live                       # calls the model, writes scripts/eval/out/report.md
pnpm eval --live --only guardian       # one article
pnpm eval --live --pick crackdown,foot --no-summary   # a few cases, no summaries
pnpm eval --live --provider openai --model gpt-6.1-mini --thinking low
```

`--live` reads `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) and
`OPENROUTER_API_KEY` from the environment or from a `.env` file in the project root (git-ignored).
These keys are only for the evaluation script: the extension uses the keys saved on its settings page.
ChatGPT sign-in only works inside the extension.

The report shows every card and flags padding (notes on ordinary words, combinations for idioms,
retold meanings, plain English on clear sentences). Tune `src/lib/llm/prompts.ts`, bump
`PROMPT_VERSION` so cached answers are not reused, and run again.

## Privacy

Nothing leaves the browser until you click the icon. Each request sends the page title, the paragraph
around the selection, the selection, and the article summary (once it exists) to the provider you
chose, with your key or your ChatGPT sign-in. Pressing a speaker sends that word or sentence to Google's voice service, and the YouGlish and
Oxford links send the word to those sites, only when you click them. The console only ever shows event names, error codes, status codes and counts, never page
text or answers.
