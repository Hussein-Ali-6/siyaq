import type { Span } from '@/lib/types';

export interface FlatNode {
  node: Text;
  start: number;
}

/** Every text node under `root` in document order, concatenated, with each node's start offset. */
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
        return SKIP_TAGS.has((node as Element).tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    nodes.push({ node: t, start: text.length });
    text += t.data;
  }
  return { root, text, nodes };
}

/** Offset in the flat text of a DOM point. Points outside the model clamp to its ends. */
export function pointToOffset(model: FlatModel, container: Node, offset: number): number {
  if (container.nodeType === Node.TEXT_NODE) {
    const entry = model.nodes.find((e) => e.node === container);
    if (entry) return entry.start + Math.min(offset, entry.node.data.length);
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

function offsetToPoint(model: FlatModel, offset: number, edge: 'start' | 'end'): { node: Text; offset: number } | null {
  if (edge === 'start') {
    for (const entry of model.nodes) {
      const len = entry.node.data.length;
      if (entry.start + len > offset && offset >= entry.start) return { node: entry.node, offset: offset - entry.start };
    }
    return null;
  }
  for (let k = model.nodes.length - 1; k >= 0; k--) {
    const entry = model.nodes[k]!;
    const len = entry.node.data.length;
    if (entry.start < offset && offset <= entry.start + len) return { node: entry.node, offset: offset - entry.start };
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
