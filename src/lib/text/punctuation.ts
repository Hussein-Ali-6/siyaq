/**
 * Chinese print uses full-width punctuation, but models often answer with the half-width marks of
 * English, even when the prompt asks for the language's own. This turns a half-width , ; : ? ! ( )
 * into its full-width form wherever it sits next to a Chinese character or to a mark that is already
 * full-width, and drops the spaces around it. Marks between Latin letters or digits ("3,000",
 * "10:30", "offer, request") are left alone, and so is text with no Chinese characters.
 */
const FULL_WIDTH: Record<string, string> = { ',': '，', ';': '；', ':': '：', '?': '？', '!': '！', '(': '（', ')': '）' };
const HALF = '[,;:?!()]';
// A Chinese character, or punctuation that only Chinese text uses.
const CHINESE = '[\\p{Script=Han}，。、；：？！（）《》「」『』【】]';
const AFTER_CHINESE = new RegExp(`(?<=${CHINESE})[ \\t]*(${HALF})[ \\t]*`, 'gu');
const BEFORE_CHINESE = new RegExp(`[ \\t]*(${HALF})[ \\t]*(?=${CHINESE})`, 'gu');
const widen = (_match: string, mark: string) => FULL_WIDTH[mark] ?? mark;

export function toFullWidthPunctuation(text: string): string {
  let out = text;
  // A converted mark can make its neighbour convertible, as in "(apple),香蕉", so repeat until stable.
  for (let pass = 0; pass < 4; pass++) {
    const next = out.replace(AFTER_CHINESE, widen).replace(BEFORE_CHINESE, widen);
    if (next === out) break;
    out = next;
  }
  return out;
}
