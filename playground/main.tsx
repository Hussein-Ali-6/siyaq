import cssText from '../src/entrypoints/content/style.css?inline';
import { createCardUi } from '@/ui/card/mount';
import { initialCardState, type CardActions, type CardEntry, type CardState } from '@/ui/card/state';
import type { DictionaryCard, TranslationCard } from '@/lib/types';

const dictionary: DictionaryCard = {
  kind: 'word',
  language: 'ar',
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  ipaUk: 'ˌtɜːn ˈdaʊn',
  ipaUs: 'ˌtɝːn ˈdaʊn',
  unitIndices: [11, 14],
  meaning: 'to refuse an offer, request or proposal',
  translation: 'رفض',
  notes: ['Informal in speech; "decline" is the formal equivalent.'],
  sentenceTranslation: 'بعد نقاش قصير، رفض المجلس العرض.',
  examples: ['She turned down the job because the salary was too low.', 'They turned our request down without any explanation.'],
  combinations: ['turn down an offer', 'turn down a request', 'flatly turn down'],
  otherMeanings: [
    { meaning: 'to reduce the sound, heat or power of a machine', translation: 'خفّض' },
    { meaning: 'to fold part of something downwards', translation: 'طوى / ثنى' },
  ],
};

const translation: TranslationCard = {
  kind: 'sentence',
  language: 'ar',
  translation:
    'انهارت الصفقة في اللحظة الأخيرة، وخرج المستثمرون منها بلا شيء. وبصرف النظر عمّا سبق، يلتزم المرخَّص له بتعويض المرخِّص عن أي مطالبات من الغير تنشأ عن استخدامه للبرنامج.',
  plainEnglish:
    'The deal failed right before it was final, so the investors got nothing. Even so, whoever uses the software must cover the owner’s costs if someone else makes a claim because of that use.',
  keyExpressions: [
    { expression: 'fell through', indices: [3, 4], meaning: 'failed to happen after being planned', translation: 'فشلت' },
    { expression: 'indemnify', indices: [22], meaning: 'to promise to pay for any loss or damage someone suffers', translation: 'عوّض' },
  ],
};

const longSelection =
  'The deal fell through at the last minute, and the investors walked away with nothing. Notwithstanding the foregoing, the licensee shall indemnify the licensor against any claims by others arising from its use of the software.';
const sentenceText = 'After a short debate it turned the offer down.';
const segments = [
  { text: 'After a short debate it ' },
  { text: 'turned', bold: true },
  { text: ' the offer ' },
  { text: 'down', bold: true },
  { text: '.' },
];

function entry(partial: Partial<CardEntry> & Pick<CardEntry, 'kind' | 'status'>): CardEntry {
  return { key: Math.random().toString(36).slice(2), selection: 'turned', saved: false, model: 'anthropic:claude-sonnet-5-5', ...partial };
}

const noop = () => undefined;
const actions: CardActions = {
  openFromIcon: noop,
  close: noop,
  back: noop,
  toggleSummary: noop,
  retry: noop,
  toggleSave: noop,
  openKeyExpression: noop,
  openSettings: noop,
};

const anchor = { top: 150, bottom: 180, left: 120, right: 220 };
const base = (): CardState => initialCardState();
const ready = (extra: Partial<CardEntry> = {}) =>
  entry({ kind: 'word', status: 'ready', card: dictionary, id: 'x', sentence: sentenceText, sentenceSegments: segments, ...extra });

const summaryText = {
  language: 'ar',
  english:
    'The article tells the story of a startup whose board rejected a buyout offer after a short debate. The founders had spent their funding quickly and leaked their plans, so the rejection surprised nobody. A later deal also collapsed at the last minute, leaving investors with nothing.',
  translation:
    'يروي المقال قصة شركة ناشئة رفض مجلس إدارتها عرض استحواذ بعد نقاش قصير. كان المؤسسون قد أنفقوا تمويلهم بسرعة وسرّبوا خططهم، فلم يفاجئ الرفض أحدًا. كما انهارت صفقة لاحقة في اللحظة الأخيرة، فخرج المستثمرون بلا شيء.',
};

const scenarios: Array<{ name: string; state: () => CardState }> = [
  { name: 'icon', state: () => ({ ...base(), icon: { x: 300, y: 185 } }) },
  { name: 'loading', state: () => ({ ...base(), card: { anchor, showSummary: false, stack: [entry({ kind: 'word', status: 'loading' })] } }) },
  { name: 'dictionary', state: () => ({ ...base(), card: { anchor, showSummary: false, stack: [ready({ saved: true })] } }) },
  { name: 'dictionary light', state: () => ({ ...base(), theme: 'light', card: { anchor, showSummary: false, stack: [ready()] } }) },
  {
    name: 'translation',
    state: () => ({
      ...base(),
      card: { anchor, showSummary: false, stack: [entry({ kind: 'sentence', status: 'ready', card: translation, id: 'y', selection: longSelection })] },
    }),
  },
  {
    name: 'stacked',
    state: () => ({
      ...base(),
      card: {
        anchor,
        showSummary: false,
        stack: [
          entry({ kind: 'sentence', status: 'ready', card: translation, id: 'y', selection: 'The deal fell through.' }),
          entry({ kind: 'word', status: 'loading', selection: 'fell through' }),
        ],
      },
    }),
  },
  {
    name: 'error',
    state: () => ({
      ...base(),
      card: {
        anchor,
        showSummary: false,
        stack: [entry({ kind: 'word', status: 'error', error: { code: 'no_key', message: 'Add your Anthropic API key in Siyaq settings.' } })],
      },
    }),
  },
  { name: 'summary', state: () => ({ ...base(), summary: { status: 'ready', summary: summaryText }, card: { anchor, showSummary: true, stack: [ready()] } }) },
  { name: 'summary loading', state: () => ({ ...base(), summary: { status: 'loading' }, card: { anchor, showSummary: true, stack: [ready()] } }) },
];

const ui = createCardUi(document, cssText, 'siyaq-root');
const toolbar = document.getElementById('toolbar')!;
for (const s of scenarios) {
  const b = document.createElement('button');
  b.textContent = s.name;
  b.onclick = () => {
    location.hash = s.name;
    ui.render(s.state(), actions);
  };
  toolbar.append(b);
}
const smallRoot = document.createElement('button');
smallRoot.textContent = 'site root 10px';
smallRoot.title = 'Simulate a site that sets html { font-size: 62.5% }';
smallRoot.onclick = () => {
  const el = document.documentElement;
  el.style.fontSize = el.style.fontSize ? '' : '62.5%';
};
toolbar.append(smallRoot);
const dark = document.createElement('button');
dark.textContent = 'page dark/light';
dark.onclick = () => document.body.classList.toggle('dark');
toolbar.append(dark);

const initial = scenarios.find((s) => s.name === decodeURIComponent(location.hash.slice(1))) ?? scenarios[2]!;
ui.render(initial.state(), actions);
