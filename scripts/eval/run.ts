/**
 * Live evaluation of the prompts on real articles.
 *
 *   pnpm eval            dry run: builds every request and prints the numbered passages
 *   pnpm eval --live     calls the model and writes scripts/eval/out/report-ar-C1.md (see --language below)
 *   pnpm eval --live --provider openai --model gpt-6.1-mini --thinking low
 *        providers: anthropic (default), openai, google, openrouter; keys come from ANTHROPIC_API_KEY,
 *        OPENAI_API_KEY, GOOGLE_API_KEY (or GEMINI_API_KEY) and OPENROUTER_API_KEY. ChatGPT sign-in
 *        only works inside the extension.
 *   pnpm eval --only pg  limits to articles whose id contains "pg"
 *   pnpm eval --live --pick crackdown,outlier --no-summary   only those selections, no summaries
 *   pnpm eval --live --language es --level B2   reader settings: a language id from src/lib/languages.ts
 *        ("none" for English only, "x:Kurdish" for a typed language) and B1, B2 or C1.
 *        Defaults: ar and C1. The report goes to scripts/eval/out/report-<language>-<level>.md.
 *
 * Pages are fetched once and cached under scripts/eval/.cache/. An article with a "file" in cases.json
 * is read from this repository instead (the store articles: pnpm eval --only store). A live run also
 * writes the raw answers to scripts/eval/out/cards-<language>-<level>.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { NO_TRANSLATION, languageName } from '@/lib/languages';
import { createAiSdkClient } from '@/lib/llm/aisdk';
import { DEFAULT_ANTHROPIC_MODEL, createAnthropicClient } from '@/lib/llm/anthropic';
import type { LlmClient, Thinking } from '@/lib/llm/types';
import { performLookup } from '@/lib/llm/lookup';
import type { Reader } from '@/lib/llm/prompts';
import { performSummary } from '@/lib/llm/summary';
import { extractArticle } from '@/lib/dom/article';
import { buildFlatModel, spanToRange } from '@/lib/dom/flat';
import { buildLookupRequest, readSelection } from '@/lib/dom/selection';
import { buildNumberedPassage } from '@/lib/text/tokens';
import { countWords } from '@/lib/text/words';
import type { Card, Level, LookupRequest, Summary } from '@/lib/types';

interface Expect {
  unit?: string;
  notes?: 'none' | 'some';
  combos?: 'none' | 'some';
  plain?: 'none' | 'any';
  keyExpr?: 'none';
  avoidKeyExpr?: string[];
}
interface Selection {
  text: string;
  context?: string;
  kind: 'word' | 'sentence';
  expect?: Expect;
  why?: string;
}
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

const here = new URL('.', import.meta.url);
// Read API keys from the project's .env when present, without printing anything from it.
const envFile = new URL('../../.env', here);
if (existsSync(envFile)) process.loadEnvFile(envFile.pathname);
const cases = JSON.parse(readFileSync(new URL('cases.json', here), 'utf8')) as { articles: Article[] };
const args = process.argv.slice(2);
const live = args.includes('--live');
const flagValue = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const only = flagValue('--only');
const pick = flagValue('--pick')?.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
const withSummary = !args.includes('--no-summary');
const level = (flagValue('--level') ?? 'C1') as Level;
if (!['B1', 'B2', 'C1'].includes(level)) {
  console.error(`Unknown level "${level}". Use B1, B2 or C1.`);
  process.exit(1);
}
const reader: Reader = { language: flagValue('--language') ?? 'ar', level };
const readerLabel = `${languageName(reader.language)}, ${reader.level}`;
const picked = (sel: Selection) => !pick || pick.some((p) => sel.text.toLowerCase().startsWith(p));
const cacheDir = new URL('.cache/', here);
const outDir = new URL('out/', here);
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

async function fetchHtml(article: Article): Promise<string> {
  if (article.file) return readFileSync(new URL(`../../${article.file}`, here), 'utf8');
  const file = new URL(`${article.id}.html`, cacheDir);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const res = await fetch(article.url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36' } });
  if (!res.ok) throw new Error(`fetch ${article.url}: ${res.status}`);
  const html = await res.text();
  writeFileSync(file, html);
  return html;
}

/** Installs the jsdom window's DOM classes as globals so the extension's DOM modules run in Node. */
function installGlobals(dom: JSDOM): void {
  const w = dom.window as unknown as Record<string, unknown>;
  for (const name of ['Node', 'NodeFilter', 'DOMParser', 'Range', 'Text', 'Element', 'HTMLElement', 'document', 'window']) {
    (globalThis as Record<string, unknown>)[name] = w[name];
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Selects `sel.text` (near `sel.context` when given) in the document and returns the selection info. */
function select(dom: JSDOM, sel: Selection) {
  const doc = dom.window.document;
  const model = buildFlatModel(doc.body);
  const flexible = (s: string) => s.split(/\s+/).map(escapeRegex).join('\\s+');
  let start = -1;
  let end = -1;
  if (sel.context) {
    const ctx = new RegExp(flexible(sel.context), 'u').exec(model.text);
    if (ctx) {
      const inner = new RegExp(flexible(sel.text), 'u').exec(ctx[0]);
      if (inner) {
        start = ctx.index + inner.index;
        end = start + inner[0].length;
      }
    }
  } else {
    const m = new RegExp(flexible(sel.text), 'u').exec(model.text);
    if (m) {
      start = m.index;
      end = start + m[0].length;
    }
  }
  if (start < 0) throw new Error(`selection not found: "${sel.text}"`);
  const range = spanToRange(model, { start, end });
  if (!range) throw new Error(`cannot build range for "${sel.text}"`);
  const selection = dom.window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  const info = readSelection(doc);
  if (!info) throw new Error(`readSelection returned null for "${sel.text}"`);
  return info;
}

const FORBIDDEN_NOTE = /pronounc|spell|syllable|grammar|used (?:like|as) an? (?:adjective|noun|verb|adverb)|word origin|comes from the (?:latin|greek|french|spanish)/i;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

function flags(sel: Selection, card: Card): string[] {
  const out: string[] = [];
  const e = sel.expect ?? {};
  if (card.kind === 'word') {
    if (e.unit && card.headword.toLowerCase() !== e.unit.toLowerCase()) out.push(`unit: expected "${e.unit}", got "${card.headword}"`);
    if (e.notes === 'none' && card.notes.length) out.push(`unexpected note: ${card.notes.join(' | ')}`);
    if (e.combos === 'none' && card.combinations.length) out.push(`unexpected combinations: ${card.combinations.join(', ')}`);
    for (const n of card.notes) if (FORBIDDEN_NOTE.test(n)) out.push(`forbidden note topic: ${n}`);
    if (card.examples.length !== 2) out.push(`examples: ${card.examples.length}`);
    if (/^(here|in this sentence)/i.test(card.meaning)) out.push('meaning retells the sentence');
    if (words(card.translation ?? '') > 25) out.push(`translation is long (${words(card.translation ?? '')} words)`);
    if (!card.ipaUk || !card.ipaUs) out.push('missing IPA');
  } else {
    if (e.plain === 'none' && card.plainEnglish) out.push(`unexpected plain English: ${card.plainEnglish}`);
    if (e.keyExpr === 'none' && card.keyExpressions.length) out.push(`unexpected key expressions: ${card.keyExpressions.map((k) => k.expression).join(', ')}`);
    if (card.keyExpressions.length > 3) out.push('too many key expressions');
    for (const avoid of e.avoidKeyExpr ?? []) {
      if (card.keyExpressions.some((k) => k.expression.toLowerCase().includes(avoid))) out.push(`padded key expression: ${avoid}`);
    }
    if (reader.language === NO_TRANSLATION && !card.plainEnglish) out.push('English only without plain English');
  }
  return out;
}

function cardMarkdown(card: Card): string {
  if (card.kind === 'word') {
    return [
      `**${card.headword}** · ${card.partOfSpeech} · unit ${JSON.stringify(card.unitIndices)}`,
      `- ipa: UK /${card.ipaUk ?? ''}/ · US /${card.ipaUs ?? ''}/`,
      `- meaning: ${card.meaning}`,
      `- translation: ${card.translation ?? '(none)'}`,
      `- notes: ${card.notes.length ? card.notes.join(' | ') : '(none)'}`,
      `- sentence translation: ${card.sentenceTranslation ?? '(none)'}`,
      `- examples: ${card.examples.join(' | ')}`,
      `- combinations: ${card.combinations.length ? card.combinations.join(', ') : '(none)'}`,
      `- other meanings: ${card.otherMeanings.length ? card.otherMeanings.map((m) => (m.translation ? `${m.meaning} (${m.translation})` : m.meaning)).join(' | ') : '(none)'}`,
    ].join('\n');
  }
  return [
    `- translation: ${card.translation ?? '(none)'}`,
    `- plain English: ${card.plainEnglish || '(none)'}`,
    `- key expressions: ${card.keyExpressions.length ? card.keyExpressions.map((k) => `${k.expression} ${JSON.stringify(k.indices)}: ${k.meaning}${k.translation ? ` (${k.translation})` : ''}`).join(' | ') : '(none)'}`,
  ].join('\n');
}

async function main() {
  const provider = flagValue('--provider') ?? 'anthropic';
  const thinking = (flagValue('--thinking') ?? 'medium') as Thinking;
  const keyEnv: Record<string, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
  if (!(provider in keyEnv)) {
    console.error(`Unknown provider "${provider}". Use anthropic, openai, google or openrouter.`);
    process.exit(1);
  }
  const apiKey = keyEnv[provider];
  const model = flagValue('--model') ?? (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : undefined);
  if (live && (!apiKey || !model)) {
    console.error(!apiKey ? `No API key for ${provider} (environment or .env in the project root).` : `--model is required for ${provider}.`);
    process.exit(1);
  }
  const modelId = `${provider}:${model}`;
  let client: LlmClient | null = null;
  if (live && apiKey && model) {
    client = provider === 'anthropic'
      ? createAnthropicClient(apiKey, { model, thinking })
      : createAiSdkClient(provider as 'openai' | 'google' | 'openrouter', { apiKey, model, thinking });
    console.log(`Provider ${provider}, model ${model}, thinking ${thinking}`);
  }
  console.log(`Reader: ${readerLabel}`);
  const report: string[] = [`# Siyaq evaluation ${new Date().toISOString().slice(0, 10)} · ${readerLabel}${live ? '' : ' (dry run)'}`, ''];
  let total = 0;
  let flagged = 0;
  const raw: Record<string, RawArticle> = {};

  for (const article of cases.articles) {
    if (only && !article.id.includes(only)) continue;
    if (!article.selections.some(picked)) continue;
    const html = await fetchHtml(article);
    const dom = new JSDOM(html, { url: article.url });
    installGlobals(dom);
    const doc = dom.window.document;
    const extracted = extractArticle(doc);
    const page = { url: article.url, title: extracted.title, siteName: extracted.siteName };
    console.log(`\n=== ${article.id}: ${page.title} (${page.siteName}, ${countWords(extracted.text)} words extracted)`);
    report.push(`## ${article.id}`, '', `${page.title} — ${article.url}`, '');
    const rawArticle: RawArticle = { summary: null, cards: {} };
    raw[article.id] = rawArticle;

    let summary: Summary | null = null;
    if (client && withSummary && article.summary !== false) {
      const res = await performSummary({ url: article.url, title: page.title, siteName: page.siteName, text: extracted.text }, {
        client,
        language: reader.language,
        cache: { get: async () => null, set: async () => undefined },
      });
      if (res.ok) {
        summary = res.summary;
        rawArticle.summary = res.summary;
        const n = words(res.summary.english);
        const ok = n >= 90 && n <= 160;
        if (!ok) flagged++;
        total++;
        console.log(`  • summary: ${n} words ${ok ? '✓' : '⚠ outside 100–150'}`);
        report.push(`### ${ok ? '✓' : '⚠'} Summary (${n} words)`, '', res.summary.english, '', res.summary.translation ?? '', '');
      } else {
        report.push(`### Summary failed: ${res.error.code} ${res.error.message}`, '');
      }
    }

    for (const sel of article.selections) {
      if (!picked(sel)) continue;
      total++;
      let request: LookupRequest;
      try {
        const info = select(dom, sel);
        request = buildLookupRequest(info, page).request;
      } catch (err) {
        console.log(`  ✗ ${sel.text}: ${(err as Error).message}`);
        report.push(`### ✗ ${sel.text}`, '', `Could not build request: ${(err as Error).message}`, '');
        flagged++;
        continue;
      }
      const numbered = buildNumberedPassage(request.passage);
      console.log(`  • [${request.kind}] "${sel.text}" selected=${JSON.stringify(request.selectedIndices)} paragraph=${countWords(request.paragraph)}w passage=${request.passage.tokens.length} tokens`);
      if (!client) {
        console.log(`      ${numbered.slice(0, 160)}${numbered.length > 160 ? '…' : ''}`);
        report.push(`### ${sel.text} (${sel.kind}${sel.why ? `: ${sel.why}` : ''})`, '', `Selected ${JSON.stringify(request.selectedIndices)} · paragraph ${countWords(request.paragraph)} words`, '', '```', numbered, '```', '');
        continue;
      }
      const res = await performLookup(request, { client, modelId, reader, cache: { get: async () => null, set: async () => undefined }, getSummary: async () => summary });
      if (!res.ok) {
        console.log(`      ✗ ${res.error.code}: ${res.error.message}`);
        report.push(`### ✗ ${sel.text}`, '', `${res.error.code}: ${res.error.message}`, '');
        flagged++;
        continue;
      }
      rawArticle.cards[sel.text] = res.card;
      const problems = flags(sel, res.card);
      if (problems.length) flagged++;
      console.log(`      ${problems.length ? '⚠ ' + problems.join('; ') : '✓'}`);
      report.push(
        `### ${problems.length ? '⚠' : '✓'} ${sel.text} (${sel.kind}${sel.why ? `: ${sel.why}` : ''})`,
        '',
        `Selected ${JSON.stringify(request.selectedIndices)} in: \`${numbered}\``,
        '',
        cardMarkdown(res.card),
        '',
        ...(problems.length ? ['Flags: ' + problems.join('; '), ''] : []),
      );
    }
  }
  report.unshift(`Cases: ${total}, flagged: ${flagged}`, '');
  const slug = reader.language.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const file = new URL(`report-${slug}-${reader.level}.md`, outDir);
  writeFileSync(file, report.join('\n'));
  console.log(`\n${total} cases, ${flagged} flagged. Report: ${file.pathname}`);
  if (live) {
    const rawFile = new URL(`cards-${slug}-${reader.level}.json`, outDir);
    writeFileSync(rawFile, JSON.stringify(raw, null, 2));
    console.log(`Raw answers: ${rawFile.pathname}`);
  }
}

await main();
