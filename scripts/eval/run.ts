/**
 * Live evaluation of the prompts on real articles.
 *
 *   pnpm eval            dry run: builds every request and prints the numbered passages
 *   pnpm eval --live     calls Claude (needs ANTHROPIC_API_KEY) and writes scripts/eval/out/report.md
 *   pnpm eval --only pg  limits to articles whose id contains "pg"
 *
 * Pages are fetched once and cached under scripts/eval/.cache/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createClaudeClient } from '@/lib/claude/client';
import { performLookup } from '@/lib/claude/lookup';
import { performSummary } from '@/lib/claude/summary';
import { extractArticle } from '@/lib/dom/article';
import { buildFlatModel, spanToRange } from '@/lib/dom/flat';
import { buildLookupRequest, readSelection } from '@/lib/dom/selection';
import { buildNumberedPassage } from '@/lib/text/tokens';
import { countWords } from '@/lib/text/words';
import type { Card, LookupRequest, Summary } from '@/lib/types';

interface Expect {
  unit?: string;
  notes?: 'none' | 'some';
  combos?: 'none' | 'some';
  plain?: 'none' | 'any';
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
  selections: Selection[];
}

const here = new URL('.', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('cases.json', here), 'utf8')) as { articles: Article[] };
const args = process.argv.slice(2);
const live = args.includes('--live');
const only = args[args.indexOf('--only') + 1];
const cacheDir = new URL('.cache/', here);
const outDir = new URL('out/', here);
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

async function fetchHtml(article: Article): Promise<string> {
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

function flags(sel: Selection, card: Card): string[] {
  const out: string[] = [];
  const e = sel.expect ?? {};
  if (card.kind === 'word') {
    if (e.unit && card.headword.toLowerCase() !== e.unit.toLowerCase()) out.push(`unit: expected "${e.unit}", got "${card.headword}"`);
    if (e.notes === 'none' && card.notes.length) out.push(`unexpected note: ${card.notes.join(' | ')}`);
    if (e.combos === 'none' && card.combinations.length) out.push(`unexpected combinations: ${card.combinations.join(', ')}`);
    if (card.examples.length !== 2) out.push(`examples: ${card.examples.length}`);
    if (/^(here|in this sentence)/i.test(card.meaning)) out.push('meaning retells the sentence');
  } else {
    if (e.plain === 'none' && card.plainEnglish) out.push(`unexpected plain English: ${card.plainEnglish}`);
    if (card.keyExpressions.length > 3) out.push('too many key expressions');
  }
  return out;
}

function cardMarkdown(card: Card): string {
  if (card.kind === 'word') {
    return [
      `**${card.headword}** · ${card.partOfSpeech} · unit ${JSON.stringify(card.unitIndices)}`,
      `- meaning: ${card.meaning}`,
      `- arabic: ${card.arabic}`,
      `- notes: ${card.notes.length ? card.notes.join(' | ') : '(none)'}`,
      `- sentence (ar): ${card.sentenceArabic}`,
      `- examples: ${card.examples.join(' | ')}`,
      `- combinations: ${card.combinations.length ? card.combinations.join(', ') : '(none)'}`,
      `- other meanings: ${card.otherMeanings.length ? card.otherMeanings.map((m) => `${m.meaning} (${m.arabic})`).join(' | ') : '(none)'}`,
    ].join('\n');
  }
  return [
    `- arabic: ${card.arabic}`,
    `- plain English: ${card.plainEnglish || '(none)'}`,
    `- key expressions: ${card.keyExpressions.length ? card.keyExpressions.map((k) => `${k.expression} ${JSON.stringify(k.indices)}: ${k.meaning} (${k.arabic})`).join(' | ') : '(none)'}`,
  ].join('\n');
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (live && !apiKey) {
    console.error('ANTHROPIC_API_KEY is required for --live');
    process.exit(1);
  }
  const client = live && apiKey ? createClaudeClient(apiKey) : null;
  const report: string[] = [`# Siyaq evaluation ${new Date().toISOString().slice(0, 10)}${live ? '' : ' (dry run)'}`, ''];
  let total = 0;
  let flagged = 0;

  for (const article of cases.articles) {
    if (only && !article.id.includes(only)) continue;
    const html = await fetchHtml(article);
    const dom = new JSDOM(html, { url: article.url });
    installGlobals(dom);
    const doc = dom.window.document;
    const extracted = extractArticle(doc);
    const page = { url: article.url, title: extracted.title, siteName: extracted.siteName };
    console.log(`\n=== ${article.id}: ${page.title} (${page.siteName}, ${countWords(extracted.text)} words extracted)`);
    report.push(`## ${article.id}`, '', `${page.title} — ${article.url}`, '');

    let summary: Summary | null = null;
    if (client) {
      const res = await performSummary({ url: article.url, title: page.title, siteName: page.siteName, text: extracted.text }, {
        client,
        cache: { get: async () => null, set: async () => undefined },
      });
      if (res.ok) {
        summary = res.summary;
        report.push('### Summary', '', res.summary.english, '', res.summary.arabic, '');
      } else {
        report.push(`### Summary failed: ${res.error.code} ${res.error.message}`, '');
      }
    }

    for (const sel of article.selections) {
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
      const res = await performLookup(request, { client, cache: { get: async () => null, set: async () => undefined }, getSummary: async () => summary });
      if (!res.ok) {
        console.log(`      ✗ ${res.error.code}: ${res.error.message}`);
        report.push(`### ✗ ${sel.text}`, '', `${res.error.code}: ${res.error.message}`, '');
        flagged++;
        continue;
      }
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
  const file = new URL('report.md', outDir);
  writeFileSync(file, report.join('\n'));
  console.log(`\n${total} cases, ${flagged} flagged. Report: ${file.pathname}`);
}

await main();
