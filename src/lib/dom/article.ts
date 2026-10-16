import { Readability, isProbablyReaderable } from '@mozilla/readability';
import { blockText, isBlock } from '@/lib/dom/blocks';
import { normalizeWhitespace } from '@/lib/text/words';

export const ARTICLE_MAX_WORDS = 6000;

export interface ArticleText {
  title: string;
  siteName: string;
  text: string;
  /** True when Readability found an article; false when the whole body text was used. */
  readable: boolean;
}

/** The first `max` words of `text`, keeping the original spacing inside. */
export function capWords(text: string, max: number): string {
  const re = /\S+/g;
  let count = 0;
  let end = text.length;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    count++;
    if (count === max) {
      end = m.index + m[0].length;
      break;
    }
  }
  return text.slice(0, end).trim();
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG']);

/** Plain text of an HTML fragment with line breaks at <br> and block boundaries. Parsed inertly. */
export function htmlToText(html: string): string {
  const inert = new DOMParser().parseFromString(html, 'text/html');
  let out = '';
  const walk = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += (child as Text).data;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (el.tagName === 'BR') {
          out += '\n';
          continue;
        }
        if (SKIP.has(el.tagName)) continue;
        const block = isBlock(el);
        if (block) out += '\n';
        walk(el);
        if (block) out += '\n';
      }
    }
  };
  walk(inert.body);
  return out;
}

function cleanText(text: string): string {
  return text
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metaContent(doc: Document, property: string): string {
  const el = doc.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
  return el?.getAttribute('content')?.trim() ?? '';
}

export function pageSiteName(doc: Document): string {
  return metaContent(doc, 'og:site_name') || doc.location?.hostname || '';
}

export function extractArticle(doc: Document): ArticleText {
  let title = doc.title;
  let siteName = pageSiteName(doc);
  let text = '';
  let readable = false;
  try {
    if (isProbablyReaderable(doc)) {
      const parsed = new Readability(doc.cloneNode(true) as Document).parse();
      if (parsed?.textContent && parsed.textContent.trim().length > 200) {
        text = parsed.content ? htmlToText(parsed.content) : parsed.textContent;
        title = parsed.title || title;
        siteName = parsed.siteName || siteName;
        readable = true;
      }
    }
  } catch {
    // Readability can throw on unusual documents; fall back to the body text.
  }
  if (!text) text = blockText(doc.body);
  if (!title.trim()) title = doc.querySelector('h1')?.textContent ?? '';
  return {
    title: normalizeWhitespace(title),
    siteName: normalizeWhitespace(siteName),
    text: capWords(cleanText(text), ARTICLE_MAX_WORDS),
    readable,
  };
}
