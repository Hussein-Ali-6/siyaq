# Siyaq Books: design

Date: 2026-11-01. Status: approved in conversation, awaiting review of this document.

A private website for reading English books and learning from them, for one reader: a native Arabic speaker at about
CEFR C1 who reads on a MacBook, an Android phone and a Huawei tablet. It reuses the Siyaq extension's lookup engine. The
extension stays as it is, for articles and websites; PDF support inside the extension is dropped.

## Decisions

| Topic | Decision |
|---|---|
| Platform | A website, installable to the home screen on Android and the tablet |
| Users | The owner only. One account, own API keys |
| Formats | PDF and EPUB, DRM-free only |
| Hosting | Cloudflare: one Worker serving the app and API, D1 database, R2 file storage, Cloudflare Access for sign-in |
| AI providers | Anthropic, OpenAI, Google Gemini, OpenRouter, using the user's keys. No ChatGPT plan sign-in (websites need OpenAI's approval) |
| Default PDF view | Page view (original pages, figures and tables). Reading view is one tap away |
| First version | Library, reader, lookups with book context, About this book, Story so far (on demand), Hard words per chapter, saved words |
| Later stages | Spaced-repetition review of saved words, read aloud with highlighting, text recognition for scanned PDFs, offline reading |
| Working name | Siyaq Books |

## 1. Structure and hosting

The `siyaq` repository becomes a pnpm monorepo:

```
siyaq/
  packages/core/   lookup engine moved from the extension: prompts, schemas, validation, lookup and summary pipelines,
                   providers (Anthropic SDK, AI SDK), text tokenizing, shared types
  packages/ui/     card components, theme, pronunciation and speaker buttons
  apps/extension/  the current WXT extension; behaviour unchanged, its tests keep passing
  apps/books/      the website: React + TypeScript + Tailwind v4 front end, Cloudflare Worker back end
```

Cloudflare parts:

- **Worker** serves the built React app as static assets and a JSON API under `/api/*`.
- **D1** stores books, chapters, extracted text, progress, saved words, settings, encrypted keys and every AI answer.
- **R2** stores the original PDF and EPUB files.
- **Cloudflare Access** protects the whole hostname (a `workers.dev` subdomain or a custom domain). Only the owner's email
  is allowed, signing in with an emailed code or Google. The Worker also verifies the `Cf-Access-Jwt-Assertion` token on
  every API request (signature against the team's public keys, audience tag, allowed email), so nothing is reachable
  around Access.

AI calls happen only in the Worker. Keys are entered on the settings page, encrypted with AES-GCM using a Worker secret
(`KEYS_SECRET`) and stored in D1. The browser only ever learns whether a key is set. Provider, model and thinking level
are chosen per provider, as in the extension.

The site has a web app manifest and icons so it can be added to the home screen. A minimal service worker caches only
the app shell. Offline reading is a later stage.

Free-plan limits that shape the design: the Worker's CPU limit counts computing, not waiting on AI or storage, so heavy
work (PDF and EPUB text extraction) runs in the browser. Uploads go through the Worker to R2, so a single book must be
under 100 MB.

## 2. Books and reading

### Adding a book

The reader picks or drops a file on any device. The browser of that device extracts the text, then uploads the original
file and the extracted structure.

- **PDF** (PDF.js in the browser): text items per page are grouped into lines by position, and lines into paragraphs by
  vertical gaps and indentation. Words hyphenated at a line end are joined. Lines that repeat at the top or bottom of
  many pages (running headers, footers, page numbers) are removed. Chapters come from the PDF's outline. Without an
  outline, from heading lines such as "Chapter 3" or "CHAPTER III" set larger than body text. Failing both, from groups
  of 20 pages. Each paragraph records its page and the PDF.js text-item range it came from, so a selection in page view
  maps back to it.
- **EPUB** (unzipped in the browser): chapters from the navigation document or NCX, in spine order. Paragraphs are
  extracted from each chapter's XHTML for context and stored. The original file stays in R2. The reading view loads it
  into the browser and shows each chapter's own markup, sanitized (no scripts, no remote resources), with images taken
  from the same file, so headings, emphasis and figures survive.
- **Rejected with a clear message:** PDFs with no extractable text on most pages (scanned images), EPUBs with
  `META-INF/encryption.xml` covering content (copy-protected), files over 100 MB, and other formats.

### Reading

- **Page view** (PDF only, default for PDFs): original pages rendered with PDF.js, text selectable, pinch zoom on touch.
- **Reading view** (default for EPUB, optional for PDF): text reflowed to the screen, with text size, line spacing and
  dark, light or sepia themes. PDF reading view is text only. Figures stay in page view. EPUB reading view shows the
  sanitized chapter markup, with its images.
- Switching views keeps the position.

### Looking up

Select text on a computer, or long-press a word on touch, and the س button appears. Tapping it opens the same card as
the extension: dictionary card for up to four words, translation card for longer selections. On narrow screens the card
is a bottom sheet. Each lookup sends:

- the paragraph around the selection, widened with neighbouring paragraphs to 150-400 words;
- the selection's sentence plus one sentence each side as numbered tokens (dictionary cards) or the numbered selection
  (translation cards);
- the book's title and author, the chapter title, and About this book (in place of the extension's article summary).

The pipeline is the shared one: structured output, strict validation, one retry, answers cached by book, chapter,
paragraph, selection and model.

### Progress

The position (chapter, paragraph and, for PDFs, page) is saved as the reader moves, a few seconds after scrolling stops,
and restored on any device.

## 3. Learning tools

### About this book

Made once per book, when it is first opened. One request sends the introduction or first 20 pages (4,000-6,000 words)
and asks what the model already knows about the book. It returns:

- a short overview in simple English with an Arabic version: what the book is, its setting or subject;
- the main people, places and terms introduced in those pages;
- whether the model recognizes the book (`known`).

It is shown under "About this book" and is the context for every lookup in the book.

### Story so far

Only when the reader presses the button; never prepared in the background. Cached per chapter.

- **Known book:** from the model's knowledge, up to the start of the current chapter, told not to go beyond it. The panel
  says it comes from the model's memory of the book.
- **Unknown book:** a summary of the current chapter from its start to the current position, on top of About this book.
- Simple English, about 150-200 words, with an Arabic version.

### Hard words per chapter

When a chapter is opened, one request reads that chapter and returns 10-20 words and expressions likely to be new to a
C1 reader: rare words, idioms, phrasal verbs in an unusual sense, cultural references. Each has its meaning in the
chapter, the Arabic, and the sentence it appears in. Words already saved are excluded.

- Shown as "Before you read" at the start of the chapter.
- Marked in the text with a subtle dotted underline. Tapping one opens its card.
- Cached per chapter. The next chapter's list is requested when the reader is near the end of the current one.

### Saved words

★ Save on any card stores the card, the sentence, book, chapter and page. "My words" lists them per book and overall,
with search in English or Arabic, a link back to the place in the book, delete, and CSV or JSON export. The later review
stage builds on this list.

### Cost

A book costs one request when started (About this book). Each opened chapter costs one Hard words request. Story so far
costs one request per press, cached per chapter. Lookups cost as in the extension and are cached. Hard words and About
this book use thinking "low"; lookups use the provider's chosen setting.

## 4. Errors, privacy and testing

- **Errors** follow the extension's model (no key, bad key, rate limit, overloaded, timeout, network, unusable answer,
  refused), shown in the card or panel with a retry or a link to settings. Upload errors say exactly why a file was
  rejected.
- **Privacy:** books, text and keys stay in the owner's Cloudflare account. Logs record event names and status codes,
  never book text, answers or keys.
- **Tests (Vitest):**
  - PDF reconstruction from text items: lines, paragraphs, de-hyphenation, header and footer removal, chapter detection
    by outline, heading and page groups, on fixtures from a real single-column book and a two-column paper.
  - EPUB parsing: spine and navigation order, sanitizing, DRM detection, on a Standard Ebooks fixture.
  - Mapping a page-view selection back to a paragraph and token indices.
  - Worker API handlers with local D1 and R2 (`@cloudflare/vitest-pool-workers`), including Access token verification
    and key encryption.
  - Prompts and validators for About this book, Story so far and Hard words.
- **End to end:** Playwright smoke tests against `wrangler dev` at desktop and phone sizes: upload, open, switch views,
  look up a word, save it.
- **Live checks:** the new prompts on two real books (one well known, one not), a few cases each, as with the extension.

## 5. Build stages

Each stage ends with something usable and tested.

1. **Monorepo and shared core.** Move the engine into `packages/core` and `packages/ui`, the extension into
   `apps/extension`. All existing tests pass and the extension builds unchanged.
2. **Site skeleton.** Worker, D1, R2, Access verification, settings page with encrypted keys and provider choice,
   deployed to the owner's Cloudflare account.
3. **Library and upload.** PDF and EPUB extraction in the browser, upload, book list with progress.
4. **Reader.** Page view and reading view, chapter navigation, position sync.
5. **Lookups in the reader.** Selection and long-press, the card and bottom sheet, saved words and My words.
6. **About this book and Story so far.**
7. **Hard words per chapter.**

Setup steps only the owner can do: create a Cloudflare account, run `wrangler login`, and add their email to the
Cloudflare Access policy. The README will walk through them.
