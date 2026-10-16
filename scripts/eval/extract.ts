/**
 * Prints the readable text of a saved HTML page (or a URL) so evaluation selections can be chosen.
 * Usage: pnpm tsx scripts/eval/extract.ts <file-or-url> [chars]
 */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const [, , source, limitArg] = process.argv;
if (!source) {
  console.error('usage: extract.ts <file-or-url> [chars]');
  process.exit(1);
}
const limit = Number(limitArg ?? 8000);
const html = /^https?:/.test(source)
  ? await (await fetch(source, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/130.0' } })).text()
  : readFileSync(source, 'utf8');
const dom = new JSDOM(html, { url: /^https?:/.test(source) ? source : 'https://example.com/' });
const article = new Readability(dom.window.document).parse();
console.log(`TITLE: ${article?.title ?? dom.window.document.title}`);
console.log(`SITE: ${article?.siteName ?? ''}`);
console.log(`WORDS: ${(article?.textContent ?? '').split(/\s+/).filter(Boolean).length}`);
console.log('---');
console.log((article?.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim().slice(0, limit));
