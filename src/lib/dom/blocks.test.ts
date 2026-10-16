// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blockText, collectTextBlocks, nearestBlock, widenParagraph } from '@/lib/dom/blocks';

function para(words: number, prefix: string): string {
  return Array.from({ length: words }, (_, i) => `${prefix}${i}`).join(' ');
}

describe('nearestBlock', () => {
  it('climbs to the enclosing paragraph', () => {
    document.body.innerHTML = '<article><p id="a">One <em id="e">two</em> three</p></article>';
    const em = document.getElementById('e')!;
    expect(nearestBlock(em.firstChild!)).toBe(document.getElementById('a'));
  });

  it('falls back to body for a bare text node', () => {
    document.body.innerHTML = 'loose text';
    expect(nearestBlock(document.body.firstChild!)).toBe(document.body);
  });
});

describe('collectTextBlocks', () => {
  it('returns leaf blocks with text, skipping nav, aside and footer', () => {
    document.body.innerHTML =
      '<nav><p>Menu</p></nav><article><h1>Title</h1><div><p>A</p><p>B</p></div>' +
      '<aside><p>Related</p></aside><ul><li>Item</li></ul></article><footer><p>Foot</p></footer>';
    const blocks = collectTextBlocks(document.body);
    expect(blocks.map((b) => b.textContent)).toEqual(['Title', 'A', 'B', 'Item']);
  });

  it('treats a div with direct text as a block', () => {
    document.body.innerHTML = '<div id="d">Some direct text here</div><div><p>Inner</p></div>';
    const blocks = collectTextBlocks(document.body);
    expect(blocks.map((b) => b.textContent)).toEqual(['Some direct text here', 'Inner']);
  });
});

describe('widenParagraph', () => {
  it('adds neighbours until at least 150 words, alternating after then before', () => {
    document.body.innerHTML =
      `<article><p id="p0">${para(60, 'a')}</p><p id="p1">${para(60, 'b')}</p>` +
      `<p id="p2">${para(60, 'c')}</p><p id="p3">${para(60, 'd')}</p><p id="p4">${para(60, 'e')}</p></article>`;
    const { blocks, text } = widenParagraph(document.getElementById('p2')!);
    expect(blocks.map((b) => b.id)).toEqual(['p1', 'p2', 'p3']);
    expect(text.startsWith('b0 b1')).toBe(true);
    expect(text.split('\n\n')).toHaveLength(3);
  });

  it('stops once the minimum is reached', () => {
    document.body.innerHTML =
      `<article><p id="p0">${para(300, 'a')}</p><p id="p1">${para(100, 'b')}</p><p id="p2">${para(100, 'c')}</p></article>`;
    const { blocks } = widenParagraph(document.getElementById('p1')!);
    expect(blocks.map((b) => b.id)).toEqual(['p1', 'p2']);
  });

  it('skips a neighbour that would exceed 400 words and tries the other side', () => {
    document.body.innerHTML =
      `<article><p id="p0">${para(100, 'a')}</p><p id="p1">${para(100, 'b')}</p><p id="p2">${para(350, 'c')}</p></article>`;
    const { blocks } = widenParagraph(document.getElementById('p1')!);
    expect(blocks.map((b) => b.id)).toEqual(['p0', 'p1']);
  });

  it('returns the paragraph alone when it is already long', () => {
    document.body.innerHTML = `<article><p id="p0">${para(10, 'a')}</p><p id="p1">${para(500, 'b')}</p></article>`;
    expect(widenParagraph(document.getElementById('p1')!).blocks.map((b) => b.id)).toEqual(['p1']);
  });

  it('stays inside an aside when the selection is in one', () => {
    document.body.innerHTML =
      '<article><p>Main text</p><aside><p id="s">Side note text here</p><p id="t">More side text</p></aside></article>';
    const { blocks } = widenParagraph(document.getElementById('s')!);
    expect(blocks.map((b) => b.id)).toEqual(['s', 't']);
  });

  it('skips empty neighbours', () => {
    document.body.innerHTML =
      `<article><p id="p0">${para(100, 'a')}</p><p id="empty">   </p><p id="p1">${para(100, 'b')}</p></article>`;
    const { blocks } = widenParagraph(document.getElementById('p1')!);
    expect(blocks.map((b) => b.id)).toEqual(['p0', 'p1']);
  });
});

describe('blockText', () => {
  it('collapses whitespace', () => {
    document.body.innerHTML = '<p id="p">  Hello\n   <b>big</b>  world </p>';
    expect(blockText(document.getElementById('p')!)).toBe('Hello big world');
  });
});

describe('blockText with line breaks', () => {
  it('treats <br> as a space so sentences stay separated', () => {
    document.body.innerHTML = '<p id="p">making it.<br><br>Partly my goal</p>';
    expect(blockText(document.getElementById('p')!)).toBe('making it. Partly my goal');
  });
});
