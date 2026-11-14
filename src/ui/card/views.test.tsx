import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DictionaryCard, TranslationCard } from '@/lib/types';
import { DictionaryView } from '@/ui/card/DictionaryView';
import { SummaryView } from '@/ui/card/SummaryView';
import { TranslationView } from '@/ui/card/TranslationView';
import type { CardEntry } from '@/ui/card/state';
import { cardTitle } from '@/ui/card/title';
import { Translated } from '@/ui/components/Translated';

const word: DictionaryCard = {
  kind: 'word',
  language: 'ar',
  headword: 'turn down',
  partOfSpeech: 'phrasal verb',
  ipaUk: 'ˌtɜːn ˈdaʊn',
  ipaUs: 'ˌtɝːn ˈdaʊn',
  unitIndices: [3, 6],
  meaning: 'to refuse an offer',
  translation: 'رفض',
  notes: [],
  sentenceTranslation: 'رفضوا العرض.',
  examples: ['She turned down the job.'],
  combinations: [],
  otherMeanings: [{ meaning: 'to reduce the volume', translation: 'خفّض' }],
};
const { translation: _t, sentenceTranslation: _s, ...wordEnglish } = word;
const englishOnlyWord: DictionaryCard = { ...wordEnglish, language: 'none', otherMeanings: [{ meaning: 'to reduce the volume' }] };

const sentence: TranslationCard = {
  kind: 'sentence',
  language: 'es',
  translation: 'El acuerdo fracasó.',
  plainEnglish: '',
  keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'failed', translation: 'fracasó' }],
};
const englishOnlySentence: TranslationCard = {
  kind: 'sentence',
  language: 'none',
  plainEnglish: 'The deal failed.',
  keyExpressions: [{ expression: 'fell through', indices: [3, 4], meaning: 'failed' }],
};

describe('Translated', () => {
  it('sets direction, language and script for a listed language', () => {
    expect(renderToStaticMarkup(<Translated language="fa">سلام</Translated>)).toBe('<p dir="rtl" lang="fa" data-script="Arabic" class="translated">سلام</p>');
    expect(renderToStaticMarkup(<Translated language="es" as="span" className="x">hola</Translated>)).toBe('<span dir="ltr" lang="es" class="translated x">hola</span>');
  });

  it('lets the browser pick the direction of a typed language', () => {
    expect(renderToStaticMarkup(<Translated language="x:Kurdish">سڵاو</Translated>)).toBe('<p dir="auto" class="translated">سڵاو</p>');
  });
});

describe('DictionaryView', () => {
  it('shows the translations in the card language', () => {
    const html = renderToStaticMarkup(<DictionaryView card={word} sentence="They turned the offer down." />);
    expect(html).toContain('رفض');
    expect(html).toContain('رفضوا العرض.');
    expect(html).toContain('Show translation');
    expect(html).toContain('lang="ar"');
  });

  it('shows no translation rows for an English-only card', () => {
    const html = renderToStaticMarkup(<DictionaryView card={englishOnlyWord} sentence="They turned the offer down." />);
    expect(html).not.toContain('translated');
    expect(html).not.toContain('Show translation');
    expect(html).toContain('to refuse an offer');
    expect(html).toContain('They turned the offer down.');
  });
});

describe('TranslationView', () => {
  const noop = () => undefined;

  it('shows the translation and the key expression translations', () => {
    const html = renderToStaticMarkup(<TranslationView card={sentence} selection="The deal fell through." onKeyExpression={noop} />);
    expect(html).toContain('El acuerdo fracasó.');
    expect(html).toContain('fracasó');
    expect(html).toContain('lang="es"');
  });

  it('shows only English for an English-only card', () => {
    const html = renderToStaticMarkup(<TranslationView card={englishOnlySentence} selection="The deal fell through." onKeyExpression={noop} />);
    expect(html).not.toContain('translated');
    expect(html).toContain('In plain English');
    expect(html).toContain('The deal failed.');
    expect(html).toContain('fell through');
  });
});

describe('SummaryView', () => {
  it('shows the translation only when the summary has one', () => {
    const translated = renderToStaticMarkup(<SummaryView summary={{ status: 'ready', summary: { language: 'ja', english: 'A summary.', translation: '要約です。' } }} />);
    expect(translated).toContain('要約です。');
    expect(translated).toContain('lang="ja"');
    const englishOnly = renderToStaticMarkup(<SummaryView summary={{ status: 'ready', summary: { language: 'none', english: 'A summary.' } }} />);
    expect(englishOnly).toContain('A summary.');
    expect(englishOnly).not.toContain('translated');
  });
});

describe('cardTitle', () => {
  const entry = (extra: Partial<CardEntry>): CardEntry => ({ key: 'k', kind: 'sentence', selection: 'The deal fell through.', status: 'ready', saved: false, ...extra });

  it('names a sentence card by what it gives', () => {
    expect(cardTitle(entry({ card: sentence }), false)).toBe('Translation');
    expect(cardTitle(entry({ card: englishOnlySentence }), false)).toBe('Explanation');
  });

  it('does not promise a translation before the answer arrives', () => {
    expect(cardTitle(entry({ status: 'loading' }), false)).toBe('Reading…');
    expect(cardTitle(entry({ status: 'error' }), false)).toBe('Sentence');
  });

  it('keeps the word card and summary titles', () => {
    expect(cardTitle(entry({ kind: 'word', selection: 'turned', status: 'loading' }), false)).toBe('Looking up…');
    expect(cardTitle(entry({ kind: 'word', selection: 'turned', status: 'error' }), false)).toBe('turned');
    expect(cardTitle(entry({ kind: 'word', selection: 'turned', card: word }), false)).toBe('turn down');
    expect(cardTitle(entry({ card: sentence }), true)).toBe('Article summary');
  });
});
