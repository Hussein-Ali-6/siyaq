import { describe, expect, it } from 'vitest';
import { toFullWidthPunctuation } from '@/lib/text/punctuation';

describe('toFullWidthPunctuation', () => {
  it('turns half-width marks next to a Chinese character into full-width ones', () => {
    expect(toFullWidthPunctuation('他拒绝了,然后离开。')).toBe('他拒绝了，然后离开。');
    expect(toFullWidthPunctuation('拒绝;回绝')).toBe('拒绝；回绝');
    expect(toFullWidthPunctuation('调低(音量、温度等)')).toBe('调低（音量、温度等）');
    expect(toFullWidthPunctuation('真的吗?是的!')).toBe('真的吗？是的！');
  });

  it('drops the spaces around a mark it converts', () => {
    expect(toFullWidthPunctuation('注意: 这很重要')).toBe('注意：这很重要');
    expect(toFullWidthPunctuation('你好, 世界')).toBe('你好，世界');
    expect(toFullWidthPunctuation('成本 (上海) 很高')).toBe('成本（上海）很高');
  });

  it('converts both brackets of a pair around Latin text', () => {
    expect(toFullWidthPunctuation('露丝(Ruth)说')).toBe('露丝（Ruth）说');
    expect(toFullWidthPunctuation('苹果(apple),香蕉')).toBe('苹果（apple），香蕉');
  });

  it('handles the answers that came back from the model', () => {
    expect(toFullWidthPunctuation("经营家族面包店“Marlow's”(位于芬街)的露丝·马洛拒绝了提议。")).toBe(
      "经营家族面包店“Marlow's”（位于芬街）的露丝·马洛拒绝了提议。",
    );
    expect(toFullWidthPunctuation('店主露丝·马洛表示,之所以拒绝,是因为原料更便宜,而她宁愿保持小规模,也不愿失去信任。')).toBe(
      '店主露丝·马洛表示，之所以拒绝，是因为原料更便宜，而她宁愿保持小规模，也不愿失去信任。',
    );
  });

  it('leaves marks between digits or Latin letters alone', () => {
    expect(toFullWidthPunctuation('共3,000人,下午10:30开始')).toBe('共3,000人，下午10:30开始');
    expect(toFullWidthPunctuation('例如 offer, request 等词')).toBe('例如 offer, request 等词');
  });

  it('leaves text with no Chinese characters alone', () => {
    expect(toFullWidthPunctuation('Hola, mundo (hoy): ¿sí?')).toBe('Hola, mundo (hoy): ¿sí?');
    expect(toFullWidthPunctuation('رفض, ثم غادر')).toBe('رفض, ثم غادر');
    expect(toFullWidthPunctuation('')).toBe('');
  });

  it('keeps line breaks and gives the same text when applied twice', () => {
    const once = toFullWidthPunctuation('第一段,结束。\n\n第二段:开始(现在)。');
    expect(once).toBe('第一段，结束。\n\n第二段：开始（现在）。');
    expect(toFullWidthPunctuation(once)).toBe(once);
  });
});
