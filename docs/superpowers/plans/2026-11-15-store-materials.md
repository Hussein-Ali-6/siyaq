# Store materials for all English learners: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Chrome Web Store materials describe Siyaq as it is since version 0.2.0: for every English learner, with the translation language and the English level chosen in the settings.

**Architecture:** The listing and privacy texts are rewritten in place under `store/`. The five screenshots are recaptured from `playground/store/`, where the Spanish and Chinese card text now comes from files of live model answers instead of hand-written text. To get those answers, the evaluation script learns to read a page from this repository and to save the raw answers as JSON.

**Tech Stack:** Markdown, the Vite playground (`pnpm playground`, port 5178), `scripts/eval/run.ts` (tsx, jsdom), headless Google Chrome and `sips` through `scripts/store/capture.sh`.

**Spec:** `docs/superpowers/specs/2026-11-13-language-setting-design.md`, section "Docs and store materials".

## Global Constraints

- Branch `store-materials`, cut from `main` at `ce4dc50`. Do not push and do not merge without the user's word.
- No attribution lines in commits: no `Co-Authored-By`, no "Generated with" line.
- Before starting any subagent, ask the user which model to use.
- Live model calls spend the user's money. Before each batch, tell the user the number of calls and wait for an explicit yes. "No preference" is not a yes. Never print the key from `.env`.
- Always pass `--language` and `--level` to `pnpm eval`. The defaults (`ar`, `C1`) would overwrite `scripts/eval/out/report-ar-C1.md`, the record of the Arabic live check.
- Manifest summary, exactly: `Understand English words and sentences in context, with translation into your language, powered by the AI model you choose.`
- Promo tile tagline, exactly: `English words and sentences, explained in your language, in context.` The Arabic line is removed.
- Screenshots, 1280×800, in this order:

  | Screenshot | Shows |
  |---|---|
  | 1. Dictionary card | Spanish |
  | 2. Sentence translation | Arabic |
  | 3. Page summary | Chinese (Simplified) |
  | 4. My words | A mix of languages |
  | 5. Settings | The Reading section |

- The Spanish and Chinese fixture text is taken from live model answers and then read through. It is not written or corrected by hand. The Arabic fixture text stays as it is.
- Store listings exist in English and Arabic only. Siyaq's own labels stay in English.
- Every task that changes code ends with `pnpm typecheck`, `pnpm test` and `pnpm build` passing.

## Decisions made in this plan that the spec does not state

The user can change any of these before the work starts.

1. **Level B2 for the screenshot answers.** B2 is what a new install starts with. It has never been run live (the earlier checks used C1 and B1), so these calls are also its first check.
2. **Six live calls, which replace the four-call Chinese re-run.** Two in Spanish and four in Simplified Chinese. The Chinese ones include a real summary and two word cards, which is enough to see whether the punctuation line in the prompts works.
3. **The summary screenshot keeps the short English summary.** The summary prompt asks for 100 to 150 words. With its Chinese translation that is taller than the card can grow in an 800 px window (560 px), so the Chinese would be cut off. The screenshot keeps the 59-word English summary it has now, and its Chinese is the model's own translation of that paragraph, made through the sentence lookup. The real Chinese summary is still requested and kept in the live file as the punctuation check.
4. **The settings screenshot shows Spanish and Upper-intermediate (B2).**
5. **The privacy documents say that the English level is sent too.** The spec names only the language. The lookup sends both.
6. **The Privacy paragraph on the settings page gains one sentence about summaries** (Task 5, Step 4). It does not say today that writing a summary sends the article text. This is outside the spec. Drop the step if it is not wanted.

## Files

| File | Change |
|---|---|
| `scripts/eval/run.ts` | An article can name a `file` in this repository and can opt out of the summary. A live run also writes the raw answers as JSON. |
| `scripts/eval/cases.json` | Two new articles: the store article and a page of source sentences. |
| `scripts/store/sources.html` | New. The source sentences of two saved words, and the short summary as a paragraph. Read only by the evaluation script. |
| `playground/store/live/es-B2.json`, `playground/store/live/zh-Hans-B2.json` | New. Raw live answers, copied unchanged from `scripts/eval/out/`. |
| `playground/store/fixtures.ts` | Spanish and Chinese cards come from the live files. Arabic cards unchanged. |
| `playground/store/promo.html` | New tagline, Arabic line removed. |
| `playground/settings-stub.ts` | A `#store` scenario that sets the language and the level. |
| `scripts/store/capture.sh` | The settings screenshot uses the `#store` scenario. |
| `store/images/*.png` | Recaptured. |
| `store/listing.md` | English and Arabic descriptions rewritten. |
| `store/privacy-practices.md`, `store/privacy-policy.md` | Language-neutral purpose, the two new settings, what is sent. |
| `src/entrypoints/options/App.tsx` | One sentence added to the Privacy paragraph (decision 6). |
| `store/README.md`, `docs/PLAN.md` | How the fixtures are made; the result of the Chinese punctuation check. |

---

### Task 1: Let the evaluation script read a page from this repository and save raw answers

The screenshots show an article that exists only in `playground/store/shots.html`. The evaluation script fetches pages from the web and writes a Markdown report, which joins lists with commas and bars and so cannot be copied into a fixture safely.

**Files:**
- Create: `scripts/store/sources.html`
- Modify: `scripts/eval/run.ts`, `scripts/eval/cases.json`

**Interfaces:**
- Produces: `pnpm eval --only store …` runs the two store articles. A live run writes `scripts/eval/out/cards-<language slug>-<level>.json` with this shape, which Task 2 copies and imports:

  ```ts
  Record<string /* article id */, { summary: Summary | null; cards: Record<string /* selection text */, Card> }>
  ```

- [ ] **Step 1: Create the page of source sentences**

Create `scripts/store/sources.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Field notes</title>
    <meta property="og:site_name" content="Field Notes" />
    <!-- Read only by the evaluation script (pnpm eval --only store). Original text. The first paragraph
         is the short summary shown in store screenshot 3, here so the model can translate it. The other
         two hold the sentences of two saved words in screenshot 4. -->
  </head>
  <body>
    <article>
      <h1>Field notes</h1>
      <p>A family bakery has refused a generous offer from a national chain that wanted to buy it. Its owner, Ruth Marlow, said no because the chain planned to use cheaper ingredients, and she would rather keep the bakery small than lose the trust it has built over four decades. Customers and other shop owners on the street welcomed the decision.</p>
      <p>The meeting ran for two hours, and every item on the agenda was discussed except one. The cost of the project was the elephant in the room. It had doubled since the spring, and nobody at the table wanted to be the first to say so.</p>
      <p>The auditors expected a mess and found the opposite. Her records were meticulous down to the last receipt. Every payment had a date, a reason and a signature beside it.</p>
    </article>
  </body>
</html>
```

- [ ] **Step 2: Add the two articles to the cases**

`scripts/eval/cases.json` is formatted exactly as Python writes it with an indent of 2, so append with a script instead of by hand:

```bash
python3 - <<'PY'
import json
path = 'scripts/eval/cases.json'
data = json.load(open(path, encoding='utf8'))
summary = ('A family bakery has refused a generous offer from a national chain that wanted to buy it. '
           'Its owner, Ruth Marlow, said no because the chain planned to use cheaper ingredients, and she would rather '
           'keep the bakery small than lose the trust it has built over four decades. '
           'Customers and other shop owners on the street welcomed the decision.')
data['articles'] += [
    {
        'id': 'store-bakery',
        'url': 'https://northbridge-review.example/business/marlows-bakery',
        'file': 'playground/store/shots.html',
        'selections': [
            {'text': 'turned', 'context': 'turned the offer down', 'kind': 'word', 'expect': {'unit': 'turn down'},
             'why': 'store screenshot 1: phrasal verb, split'},
        ],
    },
    {
        'id': 'store-sources',
        'url': 'https://field-notes.example/notes',
        'file': 'scripts/store/sources.html',
        'summary': False,
        'selections': [
            {'text': 'elephant', 'context': 'the elephant in the room', 'kind': 'word', 'why': 'store screenshot 4: idiom'},
            {'text': 'meticulous', 'kind': 'word', 'why': 'store screenshot 4: ordinary adjective'},
            {'text': summary, 'kind': 'sentence', 'why': 'store screenshot 3: the short summary, translated as a paragraph'},
        ],
    },
]
open(path, 'w', encoding='utf8').write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
PY
git diff --stat scripts/eval/cases.json
```

Expected: one file changed, insertions only (about 45 lines), no deletions.

- [ ] **Step 3: Teach the script the two new article fields**

In `scripts/eval/run.ts`, replace the `Article` interface:

```ts
interface Article {
  id: string;
  url: string;
  selections: Selection[];
}
```

with:

```ts
interface Article {
  id: string;
  url: string;
  /** A page in this repository, read instead of fetching `url`. A path from the project root. */
  file?: string;
  /** False for a page that is not an article, so no summary is asked for. */
  summary?: boolean;
  selections: Selection[];
}
/** The answers of one article exactly as the model returned them, for copying into fixtures. */
interface RawArticle {
  summary: Summary | null;
  cards: Record<string, Card>;
}
```

In `fetchHtml`, add one line at the top of the function body:

```ts
async function fetchHtml(article: Article): Promise<string> {
  if (article.file) return readFileSync(new URL(`../../${article.file}`, here), 'utf8');
  const file = new URL(`${article.id}.html`, cacheDir);
```

- [ ] **Step 4: Collect and write the raw answers**

Still in `scripts/eval/run.ts`, inside `main`. After the line `let flagged = 0;` add:

```ts
  const raw: Record<string, RawArticle> = {};
```

Replace:

```ts
    report.push(`## ${article.id}`, '', `${page.title} — ${article.url}`, '');

    let summary: Summary | null = null;
    if (client && withSummary) {
```

with:

```ts
    report.push(`## ${article.id}`, '', `${page.title} — ${article.url}`, '');
    const rawArticle: RawArticle = { summary: null, cards: {} };
    raw[article.id] = rawArticle;

    let summary: Summary | null = null;
    if (client && withSummary && article.summary !== false) {
```

Replace:

```ts
      if (res.ok) {
        summary = res.summary;
        const n = words(res.summary.english);
```

with:

```ts
      if (res.ok) {
        summary = res.summary;
        rawArticle.summary = res.summary;
        const n = words(res.summary.english);
```

Replace:

```ts
      const problems = flags(sel, res.card);
      if (problems.length) flagged++;
```

with:

```ts
      rawArticle.cards[sel.text] = res.card;
      const problems = flags(sel, res.card);
      if (problems.length) flagged++;
```

Replace the last two lines of `main`:

```ts
  writeFileSync(file, report.join('\n'));
  console.log(`\n${total} cases, ${flagged} flagged. Report: ${file.pathname}`);
```

with:

```ts
  writeFileSync(file, report.join('\n'));
  console.log(`\n${total} cases, ${flagged} flagged. Report: ${file.pathname}`);
  if (live) {
    const rawFile = new URL(`cards-${slug}-${reader.level}.json`, outDir);
    writeFileSync(rawFile, JSON.stringify(raw, null, 2));
    console.log(`Raw answers: ${rawFile.pathname}`);
  }
```

In the comment at the top of the file, replace the line ` * Pages are fetched once and cached under scripts/eval/.cache/.` with:

```ts
 * Pages are fetched once and cached under scripts/eval/.cache/. An article with a "file" in cases.json
 * is read from this repository instead (the store articles: pnpm eval --only store). A live run also
 * writes the raw answers to scripts/eval/out/cards-<language>-<level>.json.
```

- [ ] **Step 5: Dry run, with no model calls**

```bash
pnpm typecheck && pnpm eval --only store --language es --level B2
```

Expected: the type check prints nothing after `tsc --noEmit`. The dry run prints `Reader: Spanish, B2` and these lines. Long values are shortened here with `…`; the word counts and the indices shown must match:

```
=== store-bakery: The bakery that turned the buyout down · Northbridge Review (Northbridge Review, 181 words extracted)
  • [word] "turned" selected=[7] paragraph=151w …
=== store-sources: Field notes (Field Notes, 136 words extracted)
  • [word] "elephant" selected=[24] paragraph=138w …
  • [word] "meticulous" selected=[13] paragraph=138w …
  • [sentence] "A family bakery has refused …" selected=[1,2,…,60] paragraph=138w passage=60 tokens
4 cases, 0 flagged. Report: …/scripts/eval/out/report-es-B2.md
```

No `Raw answers:` line appears, because the run is not live.

- [ ] **Step 6: Commit**

```bash
pnpm test && pnpm build
git add scripts/eval/run.ts scripts/eval/cases.json scripts/store/sources.html
git commit -m "Let the evaluation script read a page from this repository and save the raw answers"
```

---

### Task 2: Take the Spanish and Chinese screenshot text from live answers

**Files:**
- Create: `playground/store/live/es-B2.json`, `playground/store/live/zh-Hans-B2.json`
- Modify: `playground/store/fixtures.ts`

**Interfaces:**
- Consumes: the raw answer files from Task 1.
- Produces: `turnDown` (Spanish), `summary` (Chinese) and the saved items in `fixtures.ts`, with the same export names as before, so `shots.tsx` and `words.tsx` need no change.

- [ ] **Step 1: Ask the user for a yes**

Say exactly what will run: "Six live calls with the default Anthropic model: two in Spanish and four in Simplified Chinese, at level B2. They give the screenshot text and also show whether the Chinese punctuation line works. May I run them?" Wait for an explicit yes.

- [ ] **Step 2: Run the Spanish calls (2 calls)**

```bash
pnpm eval --live --only store --language es --level B2 --pick turned,meticulous --no-summary
```

Expected: `Reader: Spanish, B2`, two `•` lines each followed by `✓`, then `2 cases, 0 flagged` and `Raw answers: …/scripts/eval/out/cards-es-B2.json`.

- [ ] **Step 3: Run the Chinese calls (4 calls)**

```bash
pnpm eval --live --only store --language zh-Hans --level B2 --pick 'turned,elephant,a family bakery'
```

Expected: `Reader: Chinese (Simplified), B2`, a summary line for `store-bakery`, three `•` lines, then `4 cases` and `Raw answers: …/scripts/eval/out/cards-zh-hans-B2.json`. A `⚠ outside 100–150` on the summary is not a failure here: the article has only 181 words. No summary line appears for `store-sources`.

- [ ] **Step 4: Read the answers**

Read `scripts/eval/out/report-es-B2.md` and `scripts/eval/out/report-zh-hans-B2.md` in full and check:

| Check | Where |
|---|---|
| Headword is `turn down`, and the unit holds both 7 and 10 | `turned`, both languages |
| The translation is the usual verb for refusing an offer, in a few words | `turned`, both languages |
| The headword covers the whole idiom, and the translation gives its sense, not a literal elephant | `elephant` |
| Every translation field is in the right language, with no English left in | all |
| Simplified characters, not traditional | Chinese |
| The paragraph translation says everything the English says: the offer, the reason, forty years, the neighbours | `A family bakery…` |
| Two examples and both IPA fields on each word card | all word cards |

Then check the Chinese punctuation:

```bash
perl -CSD -ne 'print "$.: $_" if /\p{Han}\s?[,:;]|[,:;]\s?\p{Han}/' scripts/eval/out/cards-zh-hans-B2.json
```

Expected: no output. A line of output is a half-width comma, colon or semicolon next to a Chinese character.

If any check fails, do not edit the answer. Tell the user which selection failed and how. For a wrong or poor answer, ask for a yes to run that language's command again (2 or 4 calls). For half-width Chinese punctuation, stop and ask the user whether to strengthen the wording in `src/lib/llm/prompts.ts` and run again, or to accept it: the prompts are outside this plan.

- [ ] **Step 5: Copy the raw answers into the playground**

```bash
mkdir -p playground/store/live
cp scripts/eval/out/cards-es-B2.json playground/store/live/es-B2.json
cp scripts/eval/out/cards-zh-hans-B2.json playground/store/live/zh-Hans-B2.json
```

- [ ] **Step 6: Point the fixtures at the live files**

In `playground/store/fixtures.ts`, replace the comment and the import at the top:

```ts
/**
 * Fixed cards for the Chrome Web Store screenshots. They follow the original article in shots.html, so
 * the pictures match what the extension would show there. Written by hand, not from a live model.
 */
import type { DictionaryCard, SavedItem, Segment, Summary, TranslationCard } from '@/lib/types';
```

with:

```ts
/**
 * Fixed cards for the Chrome Web Store screenshots. They follow the original article in shots.html, so
 * the pictures match what the extension would show there.
 *
 * The Spanish and Chinese text is not written by hand. It comes from the files in ./live, which hold
 * answers exactly as the model returned them at level B2. To refresh them, see store/README.md. The
 * Arabic text is written by hand.
 */
import type { DictionaryCard, SavedItem, Segment, Summary, TranslationCard } from '@/lib/types';
import esLive from './live/es-B2.json';
import zhLive from './live/zh-Hans-B2.json';

// The lookup code validated these answers before the evaluation script saved them.
const wordCard = (card: unknown) => card as DictionaryCard;
const sentenceCard = (card: unknown) => card as TranslationCard;
```

Replace the whole `export const turnDown: DictionaryCard = { … };` block (from `export const turnDown` to its closing `};`, 18 lines) with:

```ts
export const turnDown = wordCard(esLive['store-bakery'].cards.turned);
```

Replace the whole `export const summary: Summary = { … };` block with:

```ts
/** The same paragraph as the first one in scripts/store/sources.html, where the model translated it. */
const SUMMARY_ENGLISH =
  'A family bakery has refused a generous offer from a national chain that wanted to buy it. Its owner, Ruth Marlow, said no because the chain planned to use cheaper ingredients, and she would rather keep the bakery small than lose the trust it has built over four decades. Customers and other shop owners on the street welcomed the decision.';

export const summary: Summary = {
  language: 'zh-Hans',
  english: SUMMARY_ENGLISH,
  translation: sentenceCard(zhLive['store-sources'].cards[SUMMARY_ENGLISH]).translation ?? '',
};
```

Replace the whole `const elephant: DictionaryCard = { … };` block with:

```ts
const elephant = wordCard(zhLive['store-sources'].cards.elephant);
```

Replace the whole `const meticulous: DictionaryCard = { … };` block with:

```ts
const meticulous = wordCard(esLive['store-sources'].cards.meticulous);
```

Leave everything else as it is: `ARTICLE`, `turnDownSentence`, `turnDownSegments`, `cornersSelection`, `cornersTranslation`, `cutCorners`, `tradeOffTranslation` and `savedItems`.

- [ ] **Step 7: Check and commit**

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: all three pass. If the type check says a property does not exist on `cards`, the key in the JSON file differs from the one in the code: compare `SUMMARY_ENGLISH` with the first paragraph of `scripts/store/sources.html`, character by character.

```bash
git add playground/store/fixtures.ts playground/store/live
git commit -m "Take the Spanish and Chinese screenshot text from live answers at level B2"
```

---

### Task 3: New promo tile, a settings scenario for the store, and new images

**Files:**
- Modify: `playground/store/promo.html`, `playground/settings-stub.ts`, `scripts/store/capture.sh`
- Replace: the seven images in `store/images/`

- [ ] **Step 1: Change the promo tile**

In `playground/store/promo.html`, replace the two CSS lines:

```css
      .tile .tag { margin-top: 26px; font-size: 21px; line-height: 1.3; font-weight: 600; max-width: 330px; }
      .tile .ar { margin-top: 12px; font-family: 'Geeza Pro', 'Noto Naskh Arabic', 'Al Nile', sans-serif; font-size: 19px; color: #a3a29d; direction: rtl; text-align: left; unicode-bidi: plaintext; }
```

with the one line:

```css
      .tile .tag { margin-top: 26px; font-size: 21px; line-height: 1.3; font-weight: 600; max-width: 368px; text-wrap: balance; }
```

and replace the two lines:

```html
      <div class="tag">English words and sentences, explained in Arabic, in context.</div>
      <div class="ar">افهم الإنجليزية في سياقها</div>
```

with the one line:

```html
      <div class="tag">English words and sentences, explained in your language, in context.</div>
```

- [ ] **Step 2: Add the store scenario to the settings stub**

In `playground/settings-stub.ts`, in the comment at the top, replace:

```ts
 * #chatgpt-only (signed in, no Anthropic key, nothing chosen), default
 * (Anthropic key saved and active).
```

with:

```ts
 * #chatgpt-only (signed in, no Anthropic key, nothing chosen), #store (as the default, with Spanish
 * and Upper-intermediate chosen, for the store screenshot), default (Anthropic key saved and active).
```

After the line `store['summary:b'] = { v: {}, at: 1 };` add:

```ts
if (scenario === 'store') store.prefs = { theme: 'dark', language: 'es', level: 'B2' };
```

- [ ] **Step 3: Use the scenario in the capture script**

In `scripts/store/capture.sh`, replace:

```bash
shot screenshot-5-settings "$BASE/settings.html" 1280 800
```

with:

```bash
shot screenshot-5-settings "$BASE/settings.html#store" 1280 800
```

- [ ] **Step 4: Capture**

Start the playground on port 5178 and keep it running. In the Claude desktop app, start the preview server named `playground`. In a terminal, run `pnpm playground`. Then:

```bash
bash scripts/store/capture.sh
sips -g pixelWidth -g pixelHeight store/images/*.png | paste - - -
```

Expected: seven paths printed by the script. Sizes: the five screenshots 1280×800, `promo-small.png` 440×280, `store-icon.png` 128×128.

- [ ] **Step 5: Look at every image**

Open each file in `store/images/` and check:

| Image | Must show |
|---|---|
| `screenshot-1-dictionary.png` | The card for **turn down** with Spanish translations. The whole card is inside the frame. |
| `screenshot-2-translation.png` | The Arabic sentence translation, right to left, as before. |
| `screenshot-3-summary.png` | "Article summary", the English paragraph, then the Chinese paragraph, complete, with no scroll bar in the card. |
| `screenshot-4-my-words.png` | Five saved items. Each one names its language: Español · Spanish, العربية · Arabic, 简体中文 · Chinese (Simplified). |
| `screenshot-5-settings.png` | The Reading section at the top, with Español · Spanish chosen and Upper-intermediate (B2) selected. |
| `promo-small.png` | The new tagline on balanced lines, with no word alone on a line and no Arabic line. |
| `store-icon.png` | The icon, unchanged. |

If the Spanish card in screenshot 1 does not fit in the frame, do not shorten the text. Stop and tell the user: the choices are a different word from the article or a run at another level, and both need new calls.

- [ ] **Step 6: Commit**

```bash
pnpm typecheck && pnpm test && pnpm build
git add playground/store/promo.html playground/settings-stub.ts scripts/store/capture.sh store/images
git commit -m "Recapture the store images: Spanish, Arabic and Chinese cards, the Reading section, and the new tagline"
```

---

### Task 4: Rewrite the listing text

The manifest name and summary are already right since version 0.2.0 (`wxt.config.ts` and `package.json`). This task changes only `store/listing.md`.

**Files:**
- Modify: `store/listing.md` (replace the whole file)

- [ ] **Step 1: Replace `store/listing.md` with this content**

Besides the two descriptions, this fixes the summary line (it still said "English to Arabic") and the store icon's path in the image table (it pointed at `public/icon/128.png`, while `store/README.md` and the capture script use `store/images/store-icon.png`).

`````markdown
# Store listing

Paste these into the Chrome Web Store Developer Dashboard, **Store listing** tab. The name and the
short summary come from the manifest (`wxt.config.ts`), so they are shown here only for reference.

If the store version ships without Sign in with ChatGPT, delete the bullet that starts "your ChatGPT
plan" in the English text and "اشتراكك في ChatGPT" in the Arabic text.

## Name (from the manifest, max 75 characters)

```
Siyaq — context dictionary
```

## Summary (from the manifest, max 132 characters)

```
Understand English words and sentences in context, with translation into your language, powered by the AI model you choose.
```

## Category and language

- Category: **Education**
- Language: **English**. Add **Arabic** as a second listing language with the Arabic text below. It
  carries the same message for people who browse the store in Arabic. Siyaq's own labels are in English.

## Description (English)

```
Read English articles without leaving the page. Select a word or a sentence, click the small س button, and Siyaq explains it for the sentence you are reading, not for the word on its own, with a translation into your language.

Siyaq is for anyone who is learning English or reads it as a second language, and who wants more than a word-for-word translation.

YOUR LANGUAGE, YOUR LEVEL
Choose your translation language in the settings. The list has about 40 languages, among them Arabic, Chinese, Hindi, Portuguese and Spanish, and you can type any other. Or choose English only, and Siyaq explains everything in simple English with no translation. Then choose your English level: intermediate (B1), upper-intermediate (B2) or advanced (C1). The explanations are written for that level.

WORDS AND PHRASES
Select one word and Siyaq works out what you mean: the word itself, or the phrasal verb, idiom or saying it belongs to, even when its parts are apart, as in "turned the offer down". The card shows:
• the meaning in this sentence, in simple English, with the usual word for it in your language
• the sentence with the phrase in bold, and its translation (hidden until you click, so you can guess first)
• two everyday examples, and common word combinations when a word has strong partners
• short notes only when they help, such as the story behind an idiom, an unexpected tone or a grammar point
• British and American pronunciation, with buttons to hear it and links to YouGlish and Oxford Learner's Dictionaries
• other meanings of the word, folded away

SENTENCES AND PARAGRAPHS
Select a sentence or more and get a natural translation into your language, a plainer English version when the original is hard, and up to three key expressions you can open as their own word cards.

ARTICLE SUMMARY
The first card on a page also writes a short summary of the article, in English and in your language, which helps the next explanations and is one click away in the card and the toolbar.

MY WORDS
Save any card with ★. The My words page lists them with search in English or in your language, a link back to the sentence you found them in, and export to CSV or JSON.

YOUR AI, YOUR KEY
Siyaq has no account and no server of its own. Connect the AI provider you prefer:
• Anthropic (Claude), OpenAI, Google Gemini or OpenRouter, with your own API key
• your ChatGPT plan, through Sign in with ChatGPT
Usage is billed by your provider, not by Siyaq. Answers are saved on your computer, so asking the same thing again is free.

PRIVATE BY DESIGN
Nothing leaves your browser until you click the س button. Then only the selection, the paragraph around it, the page title, the site name, the article text for the summary, the name of your translation language and your English level go to the provider you chose. Your keys, saved words and cached answers stay in your browser. No analytics, no ads, no tracking.

Siyaq is not made by or affiliated with Anthropic, OpenAI, Google or OpenRouter.
```

## Description (Arabic)

```
اقرأ المقالات الإنجليزية دون أن تغادر الصفحة. حدّد كلمة أو جملة، واضغط زر «س» الصغير، فيشرحها لك سياق كما وردت في الجملة التي تقرؤها، لا معزولةً عنها، مع ترجمتها إلى العربية أو إلى أي لغة تختارها.

صُمّم سياق لكل من يتعلّم الإنجليزية أو يقرأ بها وليست لغته الأولى، ويريد أكثر من ترجمة حرفية.

لغتك ومستواك
اختر لغة الترجمة من الإعدادات: في القائمة نحو 40 لغة، منها العربية والصينية والهندية والبرتغالية والإسبانية، ويمكنك كتابة أي لغة أخرى. أو اختر English only (الإنجليزية فقط)، فيشرح لك سياق كل شيء بإنجليزية بسيطة دون ترجمة. ثم اختر مستواك في الإنجليزية: متوسط (B1) أو فوق المتوسط (B2) أو متقدّم (C1)، فتُكتب الشروح بما يناسبه.

الكلمات والعبارات
حدّد كلمة واحدة، وسيفهم سياق ما تقصده: الكلمة نفسها، أو الفعل المركّب أو التعبير الاصطلاحي أو المثل الذي تنتمي إليه، حتى لو تباعدت أجزاؤه كما في "turned the offer down". تعرض البطاقة:
• المعنى في هذه الجملة بإنجليزية بسيطة، مع المقابل المعتاد بلغتك
• الجملة وقد أُبرزت فيها العبارة، وترجمتها مخفيّة حتى تضغط عليها، لتخمّن أولًا
• مثالين من الحياة اليومية، والمصاحبات اللفظية الشائعة حين تكون للكلمة مصاحبات قوية
• ملاحظات قصيرة عند الحاجة فقط، كقصة التعبير الاصطلاحي، أو نبرة غير متوقعة، أو نقطة نحوية
• النطق البريطاني والأمريكي مع زر للاستماع، وروابط إلى YouGlish وقاموس أكسفورد للمتعلمين
• المعاني الأخرى للكلمة، مطويّة حتى تحتاجها

الجمل والفقرات
حدّد جملة أو أكثر لتحصل على ترجمة سلسة بلغتك، وصياغة إنجليزية أبسط إن كان النص صعبًا، وما يصل إلى ثلاثة تعابير مهمة تفتح كلًّا منها في بطاقة خاصة.

ملخّص المقال
أول بطاقة تفتحها في الصفحة تكتب أيضًا ملخصًا قصيرًا للمقال بالإنجليزية وبلغتك، يُستعان به في الشروح التالية، وتجده بضغطة واحدة في البطاقة وفي شريط الأدوات.

كلماتي
احفظ أي بطاقة بالنجمة ★. تجمع صفحة «كلماتي» ما حفظته، مع بحث بالإنجليزية أو بلغتك، ورابط يعيدك إلى الجملة التي وجدت فيها الكلمة، وتصدير بصيغة CSV أو JSON.

نموذجك ومفتاحك
لا يحتاج سياق إلى حساب، وليس له خادم خاص به. اربطه بمزوّد الذكاء الاصطناعي الذي تفضّله:
• Anthropic (Claude) أو OpenAI أو Google Gemini أو OpenRouter، بمفتاح API خاص بك
• اشتراكك في ChatGPT، عبر تسجيل الدخول بحساب ChatGPT
يحاسبك مزوّدك على الاستخدام، لا سياق. وتُحفظ الإجابات على جهازك، فلا يكلّفك تكرار السؤال نفسه شيئًا.

الخصوصية أولًا
لا يخرج شيء من متصفحك قبل أن تضغط زر «س». عندها فقط يُرسَل إلى المزوّد الذي اخترته: النص المحدّد، والفقرة المحيطة به، وعنوان الصفحة، واسم الموقع، ونص المقال لكتابة الملخص، واسم لغة الترجمة، ومستواك في الإنجليزية. أما مفاتيحك وكلماتك المحفوظة والإجابات المخزّنة فتبقى في متصفحك. لا إحصاءات ولا إعلانات ولا تتبّع.

سياق ليس من إنتاج Anthropic أو OpenAI أو Google أو OpenRouter، ولا يتبع أيًّا منها.
```

## Images

| Field | File | Size |
|---|---|---|
| Store icon | `store/images/store-icon.png` | 128×128 |
| Screenshots (up to 5) | `store/images/screenshot-*.png` | 1280×800 |
| Small promo tile | `store/images/promo-small.png` | 440×280 |
`````

- [ ] **Step 2: Check the limits and the leftovers**

```bash
python3 - <<'PY'
import re
text = open('store/listing.md', encoding='utf8').read()
blocks = re.findall(r'```\n(.*?)\n```', text, re.S)
name, summary, english, arabic = blocks
print('name', len(name), '(max 75)')
print('summary', len(summary), '(max 132)')
print('english', len(english), 'arabic', len(arabic), '(max 16000 each)')
print('"in Arabic" left in English text:', 'in Arabic' in english or 'Arabic speakers' in english)
PY
grep -c 'Understand English words and sentences in context, with translation into your language, powered by the AI model you choose.' store/listing.md wxt.config.ts package.json
```

Expected: `name 26`, `summary 123`, both descriptions far under 16000, `False` for the leftover check, and a count of 1 for each of the three files, which shows the summary in the listing is the manifest's.

- [ ] **Step 3: Commit**

```bash
git add store/listing.md
git commit -m "Rewrite the store listing for all English learners, in English and Arabic"
```

The user is the only native reader of the Arabic text. The hand-over at the end of Task 6 asks them to read it.

---

### Task 5: Privacy documents and the settings page's Privacy paragraph

**Files:**
- Modify: `store/privacy-practices.md`, `store/privacy-policy.md`, `src/entrypoints/options/App.tsx`

- [ ] **Step 1: `store/privacy-practices.md`, three replacements**

Single purpose. Replace:

```
Siyaq explains English text on web pages in Arabic. The reader selects a word or a sentence on a page, clicks Siyaq's button, and gets a dictionary card or a translation written for that context by the AI provider the reader connected.
```

with:

```
Siyaq explains English text on web pages to people who are learning English. The reader selects a word or a sentence on a page, clicks Siyaq's button, and gets a dictionary card or a translation into the language they chose, written for that context by the AI provider the reader connected.
```

Storage. Replace `Stores the reader's settings, their own AI provider API keys` with `Stores the reader's settings, including their translation language and English level, their own AI provider API keys`.

Data usage, the "Website content" row. Replace:

```
for the summary go to the provider the reader chose. |
```

with:

```
for the summary go to the provider the reader chose. The name of the reader's translation language and their English level go with each request. Those two are settings, not website content. |
```

- [ ] **Step 2: `store/privacy-policy.md`, five replacements**

Replace `Effective 13 November 2026.` with `Effective 15 November 2026.` If this step runs on a later day, write that day's date.

Replace:

```
Siyaq is a Chrome extension that explains English text on web pages in Arabic. It has no server and no
account. Its developer does not receive, see or store any of your data.
```

with:

```
Siyaq is a Chrome extension that explains English text on web pages, with a translation into the
language you choose. It has no server and no account. Its developer does not receive, see or store any
of your data.
```

Replace:

```
- Your settings: the AI provider you chose, its model and thinking level, and the theme.
```

with:

```
- Your settings: your translation language, your English level, the AI provider you chose, its model
  and thinking level, and the theme.
```

Replace:

```
- the article summary, once one exists.
```

with:

```
- the article summary, once one exists;
- the name of your translation language, as listed or as you typed it, and your English level.
```

Replace:

```
that, Siyaq sends the article's main text (up to 4,000 words), the page title and the site name. The
same happens when you ask for a summary from the toolbar button.
```

with:

```
that, Siyaq sends the article's main text (up to 4,000 words), the page title, the site name and the
name of your translation language. The same happens when you ask for a summary from the toolbar button.
```

- [ ] **Step 3: Check that no Arabic-only wording is left**

```bash
grep -n -i 'arabic' store/privacy-practices.md store/privacy-policy.md
```

Expected: no output.

- [ ] **Step 4: The settings page (decision 6; skip if the user dropped it)**

In `src/entrypoints/options/App.tsx`, in the Privacy paragraph, replace:

```
Each lookup sends the page title, the paragraph around the selection, the selection, the article summary once it exists, the name of your translation language and your English level to the provider you chose, using your key or your ChatGPT sign-in.
```

with:

```
Each lookup sends the page title, the site name, the paragraph around the selection, the selection, the article summary once it exists, the name of your translation language and your English level to the provider you chose, using your key or your ChatGPT sign-in. Writing the article summary, which the first card on a page starts, also sends the article's main text (up to 4,000 words) to the same provider.
```

Both additions are facts of the code: `pageContextBlock` in `src/lib/llm/prompts.ts` sends the site name with every lookup, and `ARTICLE_MAX_WORDS` in `src/lib/dom/article.ts` is 4000. The paragraph is at the bottom of the page, far below what screenshot 5 shows, so the image from Task 3 stays valid.

- [ ] **Step 5: Check and commit**

```bash
pnpm typecheck && pnpm test && pnpm build
git add store/privacy-practices.md store/privacy-policy.md src/entrypoints/options/App.tsx
git commit -m "Say in the privacy texts that the language and the level are stored and sent, and that a summary sends the article text"
```

If Step 4 was skipped, leave `src/entrypoints/options/App.tsx` out of the `git add` and end the message at "stored and sent".

---

### Task 6: Notes for the next person, the record of the live check, and the hand-over

**Files:**
- Modify: `store/README.md`, `docs/PLAN.md`

- [ ] **Step 1: `store/README.md`**

Replace:

```
The screenshots use the real card, My words page and settings page with hand-written fixtures and an
original article, so they need no API key. Sources are in `playground/store/`.
```

with:

```
The screenshots use the real card, My words page and settings page with fixed answers and an original
article, so capturing them needs no API key. Sources are in `playground/store/`.
```

At the end of the file, after the closing fence of the `bash` block, add:

````markdown

The Arabic card text is written by hand. The Spanish and Chinese text is the model's own, saved in
`playground/store/live/` as it came back. To refresh it (six model calls, billed to the key in `.env`):

```bash
pnpm eval --live --only store --language es --level B2 --pick turned,meticulous --no-summary
pnpm eval --live --only store --language zh-Hans --level B2 --pick 'turned,elephant,a family bakery'
cp scripts/eval/out/cards-es-B2.json playground/store/live/es-B2.json
cp scripts/eval/out/cards-zh-hans-B2.json playground/store/live/zh-Hans-B2.json
```

Read the new answers before capturing. The summary in screenshot 3 is shorter than a real one, so that
its Chinese translation fits in the card: the English is fixed in `playground/store/fixtures.ts`, and
the Chinese is the model's translation of that paragraph.
````

- [ ] **Step 2: `docs/PLAN.md`, the version 13 row**

In the row that starts `| 13 | Language and level come from settings`, replace the last sentence:

```
That line, and the prompt names such as "Simplified Chinese", were added after the checks and have not been run live yet.
```

If the punctuation check in Task 2 printed nothing, with:

```
Six more calls for the store screenshots, in Spanish and Simplified Chinese at B2 (the first live run at that level), then confirmed that line and the prompt name "Simplified Chinese": the Chinese came back with full-width punctuation.
```

If it printed lines and the user accepted them, with this, naming the field where they appeared:

```
Six more calls for the store screenshots, in Spanish and Simplified Chinese at B2 (the first live run at that level), showed that the line is not enough: half-width punctuation still appeared in FIELD. The reader accepted that.
```

- [ ] **Step 3: Final checks and commit**

```bash
pnpm typecheck && pnpm test && pnpm build
grep -rn -i 'explained in arabic\|english to arabic\|arabic speakers' store playground/store wxt.config.ts package.json README.md
git add store/README.md docs/PLAN.md
git commit -m "Describe how the screenshot text is made, and record the live check at level B2"
```

Expected: the three commands pass, and the `grep` prints nothing.

- [ ] **Step 4: Hand over to the user**

Send the user the seven images in `store/images/`. Ask them to read the Arabic description in `store/listing.md`: it is new text and they are its only native reader. Remind them of what is still open before the store submission and is not part of this plan: Sign in with ChatGPT in the store version, the OpenRouter `appUrl` in `src/lib/llm/aisdk.ts`, and a public address and contact email for the privacy policy. Then use superpowers:finishing-a-development-branch.
