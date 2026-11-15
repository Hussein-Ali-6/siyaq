/**
 * Fixed cards for the Chrome Web Store screenshots. They follow the original article in shots.html, so
 * the pictures match what the extension would show there.
 *
 * The Spanish and Chinese text is not written by hand. It comes from the files in ./live, which hold
 * the model's answers at level B2 as the lookup code returns them, so the Chinese has full-width
 * punctuation. To refresh them, see store/README.md. The Arabic text is written by hand.
 */
import type { DictionaryCard, SavedItem, Segment, Summary, TranslationCard } from '@/lib/types';
import esLive from './live/es-B2.json';
import zhLive from './live/zh-Hans-B2.json';

// The lookup code validated these answers before the evaluation script saved them.
const wordCard = (card: unknown) => card as DictionaryCard;
const sentenceCard = (card: unknown) => card as TranslationCard;

export const ARTICLE = {
  title: 'The bakery that turned the buyout down',
  url: 'https://northbridge-review.example/business/marlows-bakery',
};

export const turnDown = wordCard(esLive['store-bakery'].cards.turned);

export const turnDownSentence = 'After a short meeting, Ruth Marlow turned the offer down.';
export const turnDownSegments: Segment[] = [
  { text: 'After a short meeting, Ruth Marlow ' },
  { text: 'turned', bold: true },
  { text: ' the offer ' },
  { text: 'down', bold: true },
  { text: '.' },
];

export const cornersSelection =
  'The chain wanted to cut corners on ingredients, and she was not willing to throw decades of goodwill out of the window for a quick payday.';

export const cornersTranslation: TranslationCard = {
  kind: 'sentence',
  language: 'ar',
  translation:
    'كانت السلسلة تريد التوفير في المكوّنات على حساب جودتها، ولم تكن هي مستعدة للتفريط في سمعة طيبة بُنيت على مدى عقود مقابل ربح سريع.',
  plainEnglish:
    'The chain wanted to save money by using cheaper ingredients, and she did not want to lose the trust the bakery had earned over many years just to make money fast.',
  keyExpressions: [
    { expression: 'cut corners', indices: [5, 6], meaning: 'to do something cheaply or carelessly to save time or money', translation: 'تهاون في الجودة لتوفير المال أو الوقت' },
    { expression: 'throw … out of the window', indices: [15, 19, 20, 21, 22], meaning: 'to waste or give up something valuable', translation: 'فرّط في' },
    { expression: 'payday', indices: [26], meaning: 'a chance to earn a lot of money at once', translation: 'مكسب كبير' },
  ],
};

/** The same paragraph as the first one in scripts/store/sources.html, where the model translated it. */
const SUMMARY_ENGLISH =
  'A family bakery has refused a generous offer from a national chain that wanted to buy it. Its owner, Ruth Marlow, said no because the chain planned to use cheaper ingredients, and she would rather keep the bakery small than lose the trust it has built over four decades. Customers and other shop owners on the street welcomed the decision.';

export const summary: Summary = {
  language: 'zh-Hans',
  english: SUMMARY_ENGLISH,
  translation: sentenceCard(zhLive['store-sources'].cards[SUMMARY_ENGLISH]).translation ?? '',
};

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 13, 9, 30);

function word(id: string, card: DictionaryCard, sentence: string, segments: Segment[], pageTitle: string, url: string, daysAgo: number): SavedItem {
  return { id, kind: 'word', card, selection: card.headword, sentence, sentenceSegments: segments, pageTitle, url, savedAt: now - daysAgo * DAY };
}

const cutCorners: DictionaryCard = {
  kind: 'word',
  language: 'ar',
  headword: 'cut corners',
  partOfSpeech: 'idiom',
  ipaUk: 'ˌkʌt ˈkɔːnəz',
  ipaUs: 'ˌkʌt ˈkɔːrnɚz',
  unitIndices: [5, 6],
  meaning: 'to do something in the cheapest or quickest way, often by ignoring rules or lowering quality',
  translation: 'تهاون في الجودة لتوفير المال أو الوقت',
  notes: [],
  sentenceTranslation: 'كانت السلسلة تريد التوفير في المكوّنات على حساب جودتها.',
  examples: ['The builders cut corners, and the roof started leaking within a year.', "Don't cut corners on safety checks."],
  combinations: [],
  otherMeanings: [],
};

const elephant = wordCard(zhLive['store-sources'].cards.elephant);

const meticulous = wordCard(esLive['store-sources'].cards.meticulous);

const tradeOffTranslation: TranslationCard = {
  kind: 'sentence',
  language: 'ar',
  translation: 'كل قرار في عالم الأعمال الصغيرة مقايضة بين النمو والحفاظ على ما يجعل المكان مميزًا.',
  plainEnglish: '',
  keyExpressions: [{ expression: 'trade-off', indices: [7], meaning: 'a balance between two things you cannot have at the same time', translation: 'مقايضة' }],
};

export const savedItems: SavedItem[] = [
  word('s1', turnDown, turnDownSentence, turnDownSegments, ARTICLE.title, ARTICLE.url, 0),
  word('s2', cutCorners, cornersSelection, [
    { text: 'The chain wanted to ' },
    { text: 'cut corners', bold: true },
    { text: ' on ingredients, and she was not willing to throw decades of goodwill out of the window for a quick payday.' },
  ], ARTICLE.title, ARTICLE.url, 0),
  {
    id: 's3',
    kind: 'sentence',
    card: tradeOffTranslation,
    selection: 'Every decision in small business is a trade-off between growth and keeping what makes a place special.',
    sentence: 'Every decision in small business is a trade-off between growth and keeping what makes a place special.',
    sentenceSegments: [{ text: 'Every decision in small business is a trade-off between growth and keeping what makes a place special.' }],
    pageTitle: ARTICLE.title,
    url: ARTICLE.url,
    savedAt: now - 1 * DAY,
  },
  word('s4', elephant, 'The cost of the project was the elephant in the room.', [
    { text: 'The cost of the project was ' },
    { text: 'the elephant in the room', bold: true },
    { text: '.' },
  ], 'Why big projects run late', 'https://field-notes.example/big-projects', 3),
  word('s5', meticulous, 'Her records were meticulous down to the last receipt.', [
    { text: 'Her records were ' },
    { text: 'meticulous', bold: true },
    { text: ' down to the last receipt.' },
  ], 'The accountant who found the missing millions', 'https://field-notes.example/missing-millions', 6),
];
