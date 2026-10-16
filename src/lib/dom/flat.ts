import type { Span } from '@/lib/types';

/** A text node, or a <br> element that contributes a single "\n". */
export interface FlatNode {
  node: Text | Element;
  start: number;
  length: number;
}

/** Every text node (and <br>) under `root` in document order, concatenated, with start offsets. */
export interface FlatModel {
  root: Node;
  text: string;
  nodes: FlatNode[];
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

function documentOf(node: Node): Document {
  return node.ownerDocument ?? (node as Document);
}

export function buildFlatModel(root: Node): FlatModel {
  const nodes: FlatNode[] = [];
  let text = '';
  const walker = documentOf(root).createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName;
        if (SKIP_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;
        return tag === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      nodes.push({ node: n as Element, start: text.length, length: 1 });
      text += '\n';
    } else {
      const t = n as Text;
      nodes.push({ node: t, start: text.length, length: t.data.length });
      text += t.data;
    }
  }
  return { root, text, nodes };
}

/** Offset in the flat text of a DOM point. Points outside the model clamp to its ends. */
export function pointToOffset(model: FlatModel, container: Node, offset: number): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const entry = model.nodes.find((e) => e.node === container);
    if (entry) return entry.start + Math.min(offset, entry.length);
  }
  const probe = documentOf(model.root).createRange();
  try {
    probe.setStart(container, offset);
    probe.setEnd(container, offset);
  } catch {
    return model.text.length;
  }
  for (const entry of model.nodes) {
    try {
      if (probe.comparePoint(entry.node, 0) >= 0) return entry.start;
    } catch {
      return model.text.length;
    }
  }
  return model.text.length;
}

export function rangeToSpan(model: FlatModel, range: Range): Span {
  const a = pointToOffset(model, range.startContainer, range.startOffset);
  const b = pointToOffset(model, range.endContainer, range.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

interface DomPoint {
  node: Node;
  offset: number;
}

/** A DOM point for an offset inside `entry`; a <br> maps to the position before or after it. */
function pointIn(entry: FlatNode, offset: number): DomPoint | null {
  const local = offset - entry.start;
  if (entry.node.nodeType === Node.TEXT_NODE) return { node: entry.node, offset: local };
  const parent = entry.node.parentNode;
  if (!parent) return null;
  const index = Array.prototype.indexOf.call(parent.childNodes, entry.node);
  return { node: parent, offset: local > 0 ? index + 1 : index };
}

function offsetToPoint(model: FlatModel, offset: number, edge: 'start' | 'end'): DomPoint | null {
  if (edge === 'start') {
    for (const entry of model.nodes) {
      if (entry.start + entry.length > offset && offset >= entry.start) return pointIn(entry, offset);
    }
    return null;
  }
  for (let k = model.nodes.length - 1; k >= 0; k--) {
    const entry = model.nodes[k]!;
    if (entry.start < offset && offset <= entry.start + entry.length) return pointIn(entry, offset);
  }
  return null;
}

/** A DOM Range covering `span` of the flat text, or null when the span is empty or out of range. */
export function spanToRange(model: FlatModel, span: Span): Range | null {
  if (span.end <= span.start || span.start < 0 || span.end > model.text.length) return null;
  const s = offsetToPoint(model, span.start, 'start');
  const e = offsetToPoint(model, span.end, 'end');
  if (!s || !e) return null;
  const range = documentOf(model.root).createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  return range;
}
