// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildLookupRequest, isEditable, readSelection } from '@/lib/dom/selection';

const page = { url: 'https://example.com/a', title: 'T', siteName: 'S' };

function selectText(el: Element, text: string): Range {
  const node = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && (n as Text).data.includes(text)) as Text;
  const start = node.data.indexOf(text);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  return range;
}

function article(): void {
  document.body.innerHTML =
    '<article>' +
    '<p id="p0">Opening paragraph with some words in it.</p>' +
    '<p id="p1">The board met on Monday. After a short debate it turned the offer down. Nobody was surprised.</p>' +
    '<p id="p2">Closing paragraph with a few more words.</p>' +
    '</article>';
}

describe('isEditable', () => {
  it('detects inputs, textareas and contenteditable', () => {
    document.body.innerHTML = '<input id="i"><textarea id="t"></textarea><div id="c" contenteditable="true">x</div><p id="p">y</p>';
    expect(isEditable(document.getElementById('i'))).toBe(true);
    expect(isEditable(document.getElementById('t'))).toBe(true);
    expect(isEditable(document.getElementById('c')!.firstChild)).toBe(true);
    expect(isEditable(document.getElementById('p')!.firstChild)).toBe(false);
  });
});

describe('readSelection', () => {
  it('returns a word selection with its block', () => {
    article();
    selectText(document.getElementById('p1')!, 'turned');
    const info = readSelection(document);
    expect(info?.kind).toBe('word');
    expect(info?.text).toBe('turned');
    expect(info?.block.id).toBe('p1');
  });

  it('returns null for a collapsed selection', () => {
    article();
    window.getSelection()!.removeAllRanges();
    expect(readSelection(document)).toBeNull();
  });

  it('returns null inside an editable element', () => {
    document.body.innerHTML = '<div id="c" contenteditable="true">editable text here</div>';
    selectText(document.getElementById('c')!, 'editable');
    expect(readSelection(document)).toBeNull();
  });

  it('returns null inside the extension host', () => {
    document.body.innerHTML = '<siyaq-root><p id="h">inside host</p></siyaq-root>';
    selectText(document.getElementById('h')!, 'inside');
    expect(readSelection(document)).toBeNull();
  });

  it('classifies a long selection as a sentence', () => {
    article();
    selectText(document.getElementById('p1')!, 'After a short debate it turned the offer down.');
    expect(readSelection(document)?.kind).toBe('sentence');
  });
});

describe('buildLookupRequest on a page that uses <br> instead of paragraphs', () => {
  it('limits the paragraph to a sentence window of 150 to 400 words', () => {
    const paras = Array.from({ length: 60 }, (_, i) => `Paragraph ${i} says that the committee ${i === 30 ? 'rejected' : 'discussed'} the plan on a rainy day in town.`);
    document.body.innerHTML = `<article><p id="big">${paras.join('<br><br>')}</p></article>`;
    selectText(document.getElementById('big')!, 'rejected');
    const info = readSelection(document)!;
    const { request } = buildLookupRequest(info, page);
    const words = request.paragraph.split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(150);
    expect(words).toBeLessThanOrEqual(400);
    expect(request.paragraph).toContain('Paragraph 30 says that the committee rejected');
    expect(request.passage.text).toContain('Paragraph 30 says');
    expect(request.passage.text).not.toContain('Paragraph 27 says');
  });
});

describe('buildLookupRequest', () => {
  it('builds a word request with the sentence window and selected index', () => {
    article();
    selectText(document.getElementById('p1')!, 'turned');
    const info = readSelection(document)!;
    const { request } = buildLookupRequest(info, page);
    expect(request.kind).toBe('word');
    expect(request.selection).toBe('turned');
    expect(request.passage.text).toBe('The board met on Monday. After a short debate it turned the offer down. Nobody was surprised.');
    // The(1) board(2) met(3) on(4) Monday(5) After(6) a(7) short(8) debate(9) it(10) turned(11)
    expect(request.selectedIndices).toEqual([11]);
    expect(request.paragraph).toContain('Opening paragraph');
    expect(request.paragraph).toContain('Closing paragraph');
    expect(request.page).toEqual(page);
  });

  it('builds a sentence request numbering the selection itself', () => {
    article();
    selectText(document.getElementById('p1')!, 'After a short debate it turned the offer down.');
    const info = readSelection(document)!;
    const { request } = buildLookupRequest(info, page);
    expect(request.kind).toBe('sentence');
    expect(request.passage.text).toBe('After a short debate it turned the offer down.');
    expect(request.passage.sentence).toBeNull();
    expect(request.selectedIndices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('maps unit indices back to a DOM range for highlighting', () => {
    article();
    selectText(document.getElementById('p1')!, 'turned');
    const info = readSelection(document)!;
    const { request, rangeForIndices } = buildLookupRequest(info, page);
    const ranges = rangeForIndices(request.passage, [11, 14]);
    expect(ranges.map((r) => r.toString())).toEqual(['turned', 'down']);
  });
});

describe('readSelection on Arabic text', () => {
  it('returns null so the button does not appear', () => {
    document.body.innerHTML = '<p id="ar">ذهب أحمد إلى السوق صباح اليوم</p>';
    selectText(document.getElementById('ar')!, 'السوق');
    expect(readSelection(document)).toBeNull();
  });
});
