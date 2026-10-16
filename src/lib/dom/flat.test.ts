// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildFlatModel, rangeToSpan, spanToRange } from '@/lib/dom/flat';

describe('buildFlatModel', () => {
  it('concatenates text nodes in document order', () => {
    document.body.innerHTML = '<p id="p">Hello <b>bold</b> world</p>';
    const m = buildFlatModel(document.getElementById('p')!);
    expect(m.text).toBe('Hello bold world');
    expect(m.nodes.map((n) => n.start)).toEqual([0, 6, 10]);
  });

  it('skips script, style and template contents', () => {
    document.body.innerHTML = '<div id="d">A<script>var x = 1</script><style>.x{}</style><template>T</template>B</div>';
    expect(buildFlatModel(document.getElementById('d')!).text).toBe('AB');
  });
});

describe('rangeToSpan / spanToRange', () => {
  it('maps a text-anchored range to offsets and back', () => {
    document.body.innerHTML = '<p id="p">Hello <b>bold</b> world</p>';
    const p = document.getElementById('p')!;
    const m = buildFlatModel(p);
    const b = p.querySelector('b')!.firstChild as Text;
    const r = document.createRange();
    r.setStart(b, 1);
    r.setEnd(p.lastChild as Text, 3);
    expect(rangeToSpan(m, r)).toEqual({ start: 7, end: 13 });
    const back = spanToRange(m, { start: 7, end: 13 });
    expect(back?.toString()).toBe('old wo');
  });

  it('maps element-anchored range points', () => {
    document.body.innerHTML = '<p id="p">Hello <b>bold</b> world</p>';
    const p = document.getElementById('p')!;
    const m = buildFlatModel(p);
    const r = document.createRange();
    r.setStart(p, 1);
    r.setEnd(p, 2);
    expect(rangeToSpan(m, r)).toEqual({ start: 6, end: 10 });
  });

  it('clamps points outside the model to its ends', () => {
    document.body.innerHTML = '<div><p id="before">x</p><p id="p">Hello</p><p id="after">y</p></div>';
    const m = buildFlatModel(document.getElementById('p')!);
    const r = document.createRange();
    r.setStart(document.getElementById('before')!.firstChild!, 0);
    r.setEnd(document.getElementById('after')!.firstChild!, 1);
    expect(rangeToSpan(m, r)).toEqual({ start: 0, end: 5 });
  });

  it('returns null for an empty or out-of-range span', () => {
    document.body.innerHTML = '<p id="p">Hello</p>';
    const m = buildFlatModel(document.getElementById('p')!);
    expect(spanToRange(m, { start: 2, end: 2 })).toBeNull();
    expect(spanToRange(m, { start: 4, end: 9 })).toBeNull();
  });
});

describe('line breaks', () => {
  it('represents <br> as a newline that maps back to a DOM position', () => {
    document.body.innerHTML = '<p id="p">making it.<br><br>Partly my goal</p>';
    const m = buildFlatModel(document.getElementById('p')!);
    expect(m.text).toBe('making it.\n\nPartly my goal');
    expect(spanToRange(m, { start: 12, end: 18 })?.toString()).toBe('Partly');
  });
});
