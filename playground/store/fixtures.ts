/**
 * Fixed cards for the Chrome Web Store screenshots. They follow the original article in shots.html, so
 * the pictures match what the extension would show there. Written by hand, not from a live model.
 */
import type { DictionaryCard, SavedItem, Segment, Summary, TranslationCard } from '@/lib/types';

export const ARTICLE = {
  title: 'The bakery that turned the buyout down',
  url: 'https://northbridge-review.example/business/marlows-bakery',
};

export const turnDown: DictionaryCard = {
  kind: 'word',
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  ipaUk: 'ˌtɜːn ˈdaʊn',
  ipaUs: 'ˌtɝːn ˈdaʊn',
  unitIndices: [9, 12],
  meaning: 'to refuse an offer, request or invitation',
  arabic: 'رفض',
  notes: ['The object can go between the two parts or after them: "turned the offer down" or "turned down the offer". A pronoun must go between: "turned it down".'],
  sentenceArabic: 'رفضت روث مارلو العرض بعد اجتماع قصير.',
  examples: ['She turned down the job because the hours were too long.', 'I asked for a day off, but my manager turned me down.'],
  combinations: ['turn down an offer', 'turn down a request', 'turn down an invitation'],
  otherMeanings: [
    { meaning: 'to reduce the sound, heat or power of a machine', arabic: 'خفّض' },
    { meaning: 'to fold something downwards', arabic: 'ثنى' },
  ],
};

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
  arabic:
    'كانت السلسلة تريد التوفير في المكوّنات على حساب جودتها، ولم تكن هي مستعدة للتفريط في سمعة طيبة بُنيت على مدى عقود مقابل ربح سريع.',
  plainEnglish:
    'The chain wanted to save money by using cheaper ingredients, and she did not want to lose the trust the bakery had earned over many years just to make money fast.',
  keyExpressions: [
    { expression: 'cut corners', indices: [5, 6], meaning: 'to do something cheaply or carelessly to save time or money', arabic: 'تهاون في الجودة لتوفير المال أو الوقت' },
    { expression: 'throw … out of the window', indices: [15, 19, 20, 21, 22], meaning: 'to waste or give up something valuable', arabic: 'فرّط في' },
    { expression: 'payday', indices: [26], meaning: 'a chance to earn a lot of money at once', arabic: 'مكسب كبير' },
  ],
};

export const summary: Summary = {
  english:
    'A family bakery has refused a generous offer from a national chain that wanted to buy it. Its owner, Ruth Marlow, said no because the chain planned to use cheaper ingredients, and she would rather keep the bakery small than lose the trust it has built over four decades. Customers and other shop owners on the street welcomed the decision.',
  arabic:
    'رفض مخبز عائلي عرضًا سخيًّا من سلسلة متاجر وطنية أرادت شراءه. فقد رفضت مالكته روث مارلو العرض لأن السلسلة كانت تنوي استخدام مكوّنات أرخص، وفضّلت أن يبقى المخبز صغيرًا على أن يخسر الثقة التي بناها على مدى أربعة عقود. ورحّب الزبائن وأصحاب المتاجر الأخرى في الشارع بقرارها.',
};

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 13, 9, 30);

function word(id: string, card: DictionaryCard, sentence: string, segments: Segment[], pageTitle: string, url: string, daysAgo: number): SavedItem {
  return { id, kind: 'word', card, selection: card.headword, sentence, sentenceSegments: segments, pageTitle, url, savedAt: now - daysAgo * DAY };
}

const cutCorners: DictionaryCard = {
  kind: 'word',
  headword: 'cut corners',
  partOfSpeech: 'idiom',
  ipaUk: 'ˌkʌt ˈkɔːnəz',
  ipaUs: 'ˌkʌt ˈkɔːrnɚz',
  unitIndices: [5, 6],
  meaning: 'to do something in the cheapest or quickest way, often by ignoring rules or lowering quality',
  arabic: 'تهاون في الجودة لتوفير المال أو الوقت',
  notes: [],
  sentenceArabic: 'كانت السلسلة تريد التوفير في المكوّنات على حساب جودتها.',
  examples: ['The builders cut corners, and the roof started leaking within a year.', "Don't cut corners on safety checks."],
  combinations: [],
  otherMeanings: [],
};

const elephant: DictionaryCard = {
  kind: 'word',
  headword: 'the elephant in the room',
  partOfSpeech: 'idiom',
  ipaUk: 'ði ˈelɪfənt ɪn ðə ˈruːm',
  ipaUs: 'ði ˈeləfənt ɪn ðə ˈruːm',
  unitIndices: [4, 5, 6, 7, 8],
  meaning: 'an obvious problem that everyone knows about but nobody wants to talk about',
  arabic: 'المشكلة الواضحة التي يتجنّب الجميع الحديث عنها',
  notes: ['The image is of a huge animal standing in a small room: impossible to miss, yet everyone acts as if it is not there.'],
  sentenceArabic: 'كانت كلفة المشروع المشكلةَ التي يعرفها الجميع ويتجنّب الحديث عنها.',
  examples: ['Nobody mentioned the budget cuts, the elephant in the room.', "Let's address the elephant in the room: we are behind schedule."],
  combinations: ['address the elephant in the room', 'ignore the elephant in the room'],
  otherMeanings: [],
};

const meticulous: DictionaryCard = {
  kind: 'word',
  headword: 'meticulous',
  partOfSpeech: 'adjective',
  ipaUk: 'məˈtɪkjələs',
  ipaUs: 'məˈtɪkjələs',
  unitIndices: [7],
  meaning: 'very careful about every small detail',
  arabic: 'دقيق جدًّا ومتأنٍّ في التفاصيل',
  notes: [],
  sentenceArabic: 'كانت سجلّاتها دقيقةً في أدقّ التفاصيل.',
  examples: ['He kept meticulous notes of every meeting.', 'The repair took weeks of meticulous work.'],
  combinations: ['meticulous attention to detail', 'meticulous records', 'meticulous planning'],
  otherMeanings: [],
};

const tradeOffTranslation: TranslationCard = {
  kind: 'sentence',
  arabic: 'كل قرار في عالم الأعمال الصغيرة مقايضة بين النمو والحفاظ على ما يجعل المكان مميزًا.',
  plainEnglish: '',
  keyExpressions: [{ expression: 'trade-off', indices: [7], meaning: 'a balance between two things you cannot have at the same time', arabic: 'مقايضة' }],
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
