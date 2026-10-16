import { countWords, normalizeWhitespace } from '@/lib/text/words';

export const HOST_TAG = 'siyaq-root';

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DD', 'DT', 'TD', 'TH', 'PRE',
  'FIGCAPTION', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'UL', 'OL', 'DL',
  'TABLE', 'TBODY', 'THEAD', 'TR', 'CAPTION', 'FIGURE', 'DETAILS', 'SUMMARY', 'FORM', 'FIELDSET',
  'ADDRESS', 'HR', 'BODY',
]);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO']);
const ROOT_SELECTOR =
  'article, main, aside, nav, [role="main"], [role="article"], [role="complementary"], [role="navigation"], body';
const EXCLUDED_SELECTOR = `nav, aside, footer, [role="navigation"], [role="complementary"], [role="contentinfo"], ${HOST_TAG}`;

export const PARAGRAPH_MIN_WORDS = 150;
export const PARAGRAPH_MAX_WORDS = 400;

export function isBlock(el: Element): boolean {
  return BLOCK_TAGS.has(el.tagName);
}

/** The closest block-level ancestor (or the node itself), falling back to body. */
export function nearestBlock(node: Node): Element {
  let el: Element | null = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (el && !isBlock(el)) el = el.parentElement;
  return el ?? (node.ownerDocument ?? document).body;
}

function textOf(el: Element, stopAtBlocks: boolean): string {
  let s = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      s += (child as Text).data;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const c = child as Element;
      if (c.tagName === 'BR') {
        s += '\n';
        continue;
      }
      if (SKIP_TAGS.has(c.tagName) || (stopAtBlocks && isBlock(c))) continue;
      s += textOf(c, stopAtBlocks);
      if (!stopAtBlocks && isBlock(c)) s += ' ';
    }
  }
  return s;
}

/** The block's full text with whitespace collapsed. */
export function blockText(el: Element): string {
  return normalizeWhitespace(textOf(el, false));
}

function hasOwnText(el: Element): boolean {
  return textOf(el, true).trim().length > 0;
}

/** The container whose text blocks count as neighbours of a block. */
export function articleRoot(block: Element): Element {
  return block.closest(ROOT_SELECTOR) ?? (block.ownerDocument ?? document).body;
}

/**
 * Block elements under `root`, in document order, that carry text of their own (not only through
 * nested blocks). Navigation, sidebars and footers are skipped unless `root` itself is one.
 */
export function collectTextBlocks(root: Element): Element[] {
  const out: Element[] = [];
  if (isBlock(root) && hasOwnText(root)) out.push(root);
  const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element;
      if (SKIP_TAGS.has(el.tagName) || el.matches(EXCLUDED_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return isBlock(el) && hasOwnText(el) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Element);
  return out;
}

export interface WidenOptions {
  min?: number;
  max?: number;
}

/**
 * The paragraph containing the selection, widened with neighbouring blocks (after, then before,
 * alternating) until it has at least `min` words. A neighbour that would push the total past
 * `max` is skipped. Empty blocks are ignored.
 */
export function widenParagraph(block: Element, opts: WidenOptions = {}): { text: string; blocks: Element[] } {
  const min = opts.min ?? PARAGRAPH_MIN_WORDS;
  const max = opts.max ?? PARAGRAPH_MAX_WORDS;
  let blocks = collectTextBlocks(articleRoot(block));
  let idx = blocks.indexOf(block);
  if (idx === -1) {
    blocks = blocks.filter((b) => !block.contains(b));
    idx = blocks.findIndex((b) => (block.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
    if (idx === -1) idx = blocks.length;
    blocks.splice(idx, 0, block);
  }
  const texts = blocks.map(blockText);
  const counts = texts.map(countWords);

  let lo = idx;
  let hi = idx;
  let words = counts[idx]!;
  let afterDone = false;
  let beforeDone = false;
  let side: 'after' | 'before' = 'after';

  const nextNonEmpty = (from: number, step: 1 | -1): number => {
    for (let k = from; k >= 0 && k < blocks.length; k += step) if (counts[k]! > 0) return k;
    return -1;
  };

  while (words < min && !(afterDone && beforeDone)) {
    if (side === 'after') {
      side = 'before';
      if (afterDone) continue;
      const k = nextNonEmpty(hi + 1, 1);
      if (k === -1 || words + counts[k]! > max) {
        afterDone = true;
        continue;
      }
      hi = k;
      words += counts[k]!;
    } else {
      side = 'after';
      if (beforeDone) continue;
      const k = nextNonEmpty(lo - 1, -1);
      if (k === -1 || words + counts[k]! > max) {
        beforeDone = true;
        continue;
      }
      lo = k;
      words += counts[k]!;
    }
  }

  const chosen: Element[] = [];
  const chosenTexts: string[] = [];
  for (let k = lo; k <= hi; k++) {
    if (counts[k]! > 0 || k === idx) {
      chosen.push(blocks[k]!);
      chosenTexts.push(texts[k]!);
    }
  }
  return { blocks: chosen, text: chosenTexts.join('\n\n') };
}
