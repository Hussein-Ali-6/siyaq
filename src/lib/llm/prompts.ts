import { NO_TRANSLATION, resolveLanguage } from '@/lib/languages';
import { buildNumberedPassage } from '@/lib/text/tokens';
import { normalizeWhitespace } from '@/lib/text/words';
import type { Level, LookupRequest, PageContext, Summary } from '@/lib/types';

/** Bump when a prompt changes so cached answers made with the old prompt are not reused. */
export const PROMPT_VERSION = 13;

/** Who the answer is for: the translation language id (`@/lib/languages`) and the reading level. */
export interface Reader {
  language: string;
  level: Level;
}

/** What changes with the reading level. Advanced (C1) keeps the wording the prompts started with. */
interface LevelGuide {
  /** Added to the meaning rule. */
  meaning: string;
  /** Added to the examples rule. */
  examples: string;
  /** How often a card has notes. */
  notesOften: string;
  /** Extra reasons for a note. */
  notesAlso: string[];
  /** What is not worth a note. */
  notesLimit: string;
  /** Which expressions of a selection to explain. */
  keyExpressions: string;
  /** True when the plainer English of a selection is always given. */
  alwaysPlain: boolean;
}

const LEVELS: Record<Level, LevelGuide> = {
  B1: {
    meaning: ' Use only very common words and one short sentence, as a dictionary for intermediate learners does.',
    examples: ' Keep them short and use common words.',
    notesOften: 'Many cards have none.',
    notesAlso: [
      'a word the reader could easily confuse with this one;',
      'how the word is normally used, such as the preposition or verb pattern that goes with it;',
    ],
    notesLimit: 'Word history and background facts are not notes, and neither is anything the meaning already says. Write notes in very simple English.',
    keyExpressions:
      'up to three idioms, phrasal verbs or less common words from the selection that a B1 reader may not know. Choose the ones that matter most for understanding the selection.',
    alwaysPlain: true,
  },
  B2: {
    meaning: ' Define it with words a B2 reader knows, never with a harder word.',
    examples: '',
    notesOften: 'Many cards have none.',
    notesAlso: [
      'a word the reader could easily confuse with this one;',
      'a register a B2 reader may not expect, such as formal or old-fashioned;',
    ],
    notesLimit: 'Grammar a B2 reader already knows, word history and background facts are not notes, and neither is anything the meaning already says.',
    keyExpressions:
      "up to three idioms, phrasal verbs, unusual terms or tricky phrases from the selection that a B2 reader may not know or could misread. Words they already know don't need explaining, so some selections have none.",
    alwaysPlain: false,
  },
  C1: {
    meaning: '',
    examples: '',
    notesOften: 'Most cards have none.',
    notesAlso: [],
    notesLimit: 'Basic grammar a C1 reader already knows, word history and background facts are not notes, and neither is anything the meaning already says.',
    keyExpressions:
      "up to three idioms, unusual terms or tricky phrases from the selection that a C1 reader could plausibly misread. Common words and phrasal verbs they already know don't need explaining, so many selections have none.",
    alwaysPlain: false,
  },
};

function describeReader(reader: Reader): string {
  if (reader.language === NO_TRANSLATION) {
    return `someone who reads English at about ${reader.level} level and wants explanations in English only`;
  }
  return `a native speaker of ${resolveLanguage(reader.language).promptName} who reads English at about ${reader.level} level`;
}

// The worked examples show the English fields only, so they are the same for every language.
const DICTIONARY_EXAMPLES = `Numbered passage: "[1]The [2]board [3]met [4]on [5]Monday. [6]After [7]a [8]short [9]debate [10]it [11]turned [12]the [13]offer [14]down. [15]Nobody [16]was [17]surprised."
Selected: [11]turned
{
  "unitIndices": [11, 14],
  "headword": "turn down",
  "partOfSpeech": "phrasal verb",
  "ipaUk": "ˌtɜːn ˈdaʊn",
  "ipaUs": "ˌtɝːn ˈdaʊn",
  "meaning": "to refuse an offer, request or proposal",
  "notes": [],
  "examples": ["She turned down the job because the salary was too low.", "They turned our request down without any explanation."],
  "combinations": [],
  "otherMeanings": [{"meaning": "to reduce the sound, heat or power of a machine"}]
}

Numbered passage: "[1]The [2]forecast [3]warned [4]of [5]heavy [6]rain. [7]Most [8]people [9]decided [10]to [11]stay [12]home. [13]The [14]streets [15]were [16]empty."
Selected: [9]decided
{
  "unitIndices": [9],
  "headword": "decide",
  "partOfSpeech": "verb",
  "ipaUk": "dɪˈsaɪd",
  "ipaUs": "dɪˈsaɪd",
  "meaning": "to choose what to do after thinking about it",
  "notes": [],
  "examples": ["We decided to leave early to avoid the traffic.", "I still haven't decided which course to take."],
  "combinations": [],
  "otherMeanings": []
}

Numbered passage: "[1]Nobody [2]expected [3]much [4]from [5]the [6]small [7]club. [8]As [9]the [10]underdog, [11]it [12]had [13]nothing [14]to [15]lose. [16]It [17]won [18]the [19]cup."
Selected: [10]underdog
{
  "unitIndices": [10],
  "headword": "underdog",
  "partOfSpeech": "noun",
  "ipaUk": "ˈʌndədɒɡ",
  "ipaUs": "ˈʌndərdɔːɡ",
  "meaning": "a person or team that is expected to lose a competition or fight",
  "notes": [],
  "examples": ["Everyone loves to cheer for the underdog.", "The young lawyer was the underdog in the election."],
  "combinations": [],
  "otherMeanings": []
}

Numbered passage: "[1]He [2]promised [3]to [4]keep [5]the [6]plan [7]secret. [8]By [9]Friday [10]he [11]had [12]spilled [13]the [14]beans [15]to [16]half [17]the [18]office."
Selected: [14]beans
{
  "unitIndices": [12, 13, 14],
  "headword": "spill the beans",
  "partOfSpeech": "idiom",
  "ipaUk": "ˌspɪl ðə ˈbiːnz",
  "ipaUs": "ˌspɪl ðə ˈbiːnz",
  "meaning": "to tell people a secret, often by accident",
  "notes": ["Informal. The image is of beans spilling out of a container that should have stayed closed."],
  "examples": ["Don't spill the beans about the party; it's a surprise.", "Who spilled the beans to the press?"],
  "combinations": [],
  "otherMeanings": []
}

Numbered passage: "[1]The [2]company [3]promised [4]record [5]sales. [6]Few [7]analysts [8]believed [9]the [10]forecast. [11]Its [12]shares [13]fell."
Selected: [6]Few
{
  "unitIndices": [6],
  "headword": "few",
  "partOfSpeech": "determiner",
  "ipaUk": "fjuː",
  "ipaUs": "fjuː",
  "meaning": "a small number of people or things, often fewer than expected",
  "notes": ["Without \"a\", few stresses how small the number is, so the sentence means most analysts did not believe the forecast; \"a few\" would sound more positive."],
  "examples": ["Few people remember his first film.", "There are few places left where you can camp for free."],
  "combinations": [],
  "otherMeanings": []
}`;

export function dictionarySystem(reader: Reader): string {
  const guide = LEVELS[reader.level];
  const lang = reader.language === NO_TRANSLATION ? null : resolveLanguage(reader.language);
  const name = lang?.promptName ?? '';
  const alreadySaid = lang ? 'the meaning, translation, examples and other meanings' : 'the meaning, examples and other meanings';
  const noteReasons = [
    "a figurative use whose link to the basic meaning isn't obvious;",
    'the image or story behind an idiom;',
    'a person or reference they need to follow the sentence;',
    'an unexpected tone, such as informal, literary or offensive;',
    'grammar that changes how this sentence should be read, such as an unusual structure or a word working as another part of speech;',
    ...guide.notesAlso,
    'a likely misreading.',
  ];
  const fields = [
    `- unitIndices: the indices of the words that make up the unit the reader means. Often that is just the selected word. It can also be a phrasal verb, idiom, fixed expression, compound or name that the word belongs to, even when its parts are split ("turned the offer down" is turned + down). Prefer the smallest unit a dictionary would list as its own entry: a word together with the noun or adjective next to it is only a unit when the two form a fixed expression ("armed militias" is militia, "a modicum of" is modicum). Include at least one selected index.`,
    `- headword: the dictionary form of the unit, such as "turn down", "decision" or "spill the beans".`,
    `- partOfSpeech: a short label such as noun, verb, phrasal verb, idiom or proper noun.`,
    `- ipaUk and ipaUs: the British and American pronunciation of the headword in IPA, as a learner's dictionary such as Oxford shows it, with stress marks and without slashes. For a phrase, give the whole phrase; for a name, its usual English pronunciation.`,
    `- meaning: a short, clear explanation in simple English of the sense used here, written like a learner's dictionary entry so it would also fit other sentences with this sense. Explain the word rather than retelling the sentence.${guide.meaning}`,
    ...(lang
      ? [
          `- translation: the ${name} for this sense. Often the usual equivalent word or phrase is enough. When a single ${name} word would mislead, for example because it has several meanings and only some match, or because no ${name} word fits this sense, add a few words of clarification or give a short explanation instead. Keep it brief.`,
        ]
      : []),
    `- notes: "Good to know" notes. ${guide.notesOften} Add a note only when it tells this reader something they need for this sentence that ${alreadySaid} don't already say. There is no fixed number: write as many as are genuinely useful, and keep each one short. Good reasons include:\n${noteReasons.map((r) => `  - ${r}`).join('\n')}\n  ${guide.notesLimit} If you are unsure, leave it out. Pronunciation has its own fields, so notes don't need to cover it.`,
    ...(lang
      ? [
          `- sentenceTranslation: a natural ${name} translation of the sentence that contains the selection, as a skilled ${name} writer would put it, rendering idioms by their meaning.`,
        ]
      : []),
    `- examples: two short, natural example sentences that use the unit in the same sense, in everyday situations different from the article.${guide.examples}`,
    `- combinations: common partners worth learning together with the word, such as "make a decision" or "heavy rain", when it has strong ones.`,
    lang
      ? `- otherMeanings: other common senses of the headword, each with a short English meaning and its ${name} translation, following the same approach as the translation field. Empty when the word essentially has one sense.`
      : `- otherMeanings: other common senses of the headword, each with a short English meaning. Empty when the word essentially has one sense.`,
  ];
  const afterExamples = lang
    ? `\n\nThe examples leave out translation, sentenceTranslation and the translation inside otherMeanings to keep them short. Your answer must include them, written in ${name}, with the punctuation that language uses in print.`
    : '';
  return `You are Siyaq, a context-aware English dictionary for one reader: ${describeReader(reader)}. While reading an article in Chrome, they selected a word or short phrase and want to understand what it means here, in this sentence.

## What you receive
- The page title and site, and a summary of the article when one exists.
- The paragraph around the selection.
- A numbered passage: the sentence with the selection plus one sentence before and after, with every word prefixed by its index, like [12]gave [13]up. Punctuation is not numbered.
- The indices of the words the reader selected.

## What to return
A JSON object with the fields below. Use an empty string or an empty list when a field has nothing useful to add.

${fields.join('\n')}

## Examples

${DICTIONARY_EXAMPLES}${afterExamples}`;
}

/** Worked examples for a selection. When plainer English is always given, the simple ones show it too. */
function translationExamples(alwaysPlain: boolean): string {
  const museum = alwaysPlain ? 'The museum opens at nine, and you do not have to pay to go in on Sundays.' : '';
  const deal = alwaysPlain ? 'The deal failed at the last moment, and the investors got nothing from it.' : '';
  return `Numbered passage: "[1]The [2]museum [3]opens [4]at [5]nine [6]and [7]admission [8]is [9]free [10]on [11]Sundays."
{
  "plainEnglish": ${JSON.stringify(museum)},
  "keyExpressions": []
}

Numbered passage: "[1]The [2]deal [3]fell [4]through [5]at [6]the [7]last [8]minute, [9]and [10]the [11]investors [12]walked [13]away [14]with [15]nothing."
{
  "plainEnglish": ${JSON.stringify(deal)},
  "keyExpressions": [
    {"expression": "fell through", "indices": [3, 4], "meaning": "failed to happen after being planned"}
  ]
}

Numbered passage: "[1]Notwithstanding [2]the [3]foregoing, [4]the [5]licensee [6]shall [7]indemnify [8]the [9]licensor [10]against [11]any [12]claims [13]by [14]others [15]arising [16]from [17]its [18]use [19]of [20]the [21]software."
{
  "plainEnglish": "Even so, the person using the software must cover the owner's costs if someone else makes a claim because of that use.",
  "keyExpressions": [
    {"expression": "notwithstanding the foregoing", "indices": [1, 2, 3], "meaning": "despite what was said before"},
    {"expression": "indemnify", "indices": [7], "meaning": "to promise to pay for any loss or damage someone suffers"}
  ]
}`;
}

export function translationSystem(reader: Reader): string {
  const guide = LEVELS[reader.level];
  const lang = reader.language === NO_TRANSLATION ? null : resolveLanguage(reader.language);
  const name = lang?.promptName ?? '';
  // With no translation, the plainer English is the explanation, so it is always given.
  const alwaysPlain = guide.alwaysPlain || !lang;
  const keyExpressionParts = lang
    ? `Each has expression (as it appears in the text), indices (the indices of its words in the numbered passage), meaning (short, simple English) and translation (the usual ${name} equivalent, with a few words of clarification only when a single word would mislead).`
    : 'Each has expression (as it appears in the text), indices (the indices of its words in the numbered passage) and meaning (short, simple English).';
  const fields = [
    ...(lang
      ? [
          `- translation: a natural, fluent ${name} translation of the whole selection, as a skilled ${name} writer would express the same meaning: idiomatic rather than word for word${lang.variety ? `, in ${lang.variety}` : ''}, keeping the writer's tone and any paragraph breaks.`,
        ]
      : []),
    alwaysPlain
      ? '- plainEnglish: a plainer English restatement of the whole selection in one or two short sentences, using common words. Always give it.'
      : '- plainEnglish: a plainer English restatement in one or two sentences when the original is hard to follow, for example dense, ironic, technical or tangled. Leave it empty when the selection is clear.',
    `- keyExpressions: ${guide.keyExpressions} ${keyExpressionParts}`,
  ];
  const afterExamples = lang
    ? `\n\nThe examples leave out translation, for the selection and inside keyExpressions, to keep them short. Your answer must include them, written in ${name}, with the punctuation that language uses in print.`
    : '';
  return `You are Siyaq, ${lang ? 'a translator' : 'a reading helper'} for one reader: ${describeReader(reader)}. While reading an article in Chrome, they selected a sentence or a longer passage and want to understand it as the writer meant it.

## What you receive
- The page title and site, and a summary of the article when one exists.
- The paragraph around the selection, for context.
- The selection itself as a numbered passage, with every word prefixed by its index, like [12]gave [13]up. Punctuation is not numbered.

## What to return
A JSON object with these fields:

${fields.join('\n')}

## Examples

${translationExamples(alwaysPlain)}${afterExamples}`;
}

/** The summary does not depend on the reading level: its English is plain enough for all three. */
export function summarySystem(language: string): string {
  const english =
    '- english: a summary of 100 to 150 words, staying under 150, in simple, clear English (B1 to B2), in one or two short paragraphs. Cover what the article is about, its main points and its conclusion or argument, without adding opinions of your own.';
  const notAnArticle = 'If the text is not really an article, such as a list of links or a login page, describe what is there in a sentence or two instead.';
  if (language === NO_TRANSLATION) {
    return `You write article summaries for people who are learning English.

Return a JSON object with one field:
${english}

${notAnArticle}`;
  }
  const lang = resolveLanguage(language);
  return `You write article summaries for a native speaker of ${lang.promptName} who is learning English.

Return a JSON object with two fields:
${english}
- translation: the same summary in natural ${lang.variety ?? lang.promptName}, as a skilled ${lang.promptName} writer would put it, with the punctuation that language uses in print.

${notAnArticle}`;
}

export function pageContextBlock(page: PageContext, summary: Summary | null): string {
  const lines = ['Article context', `Title: ${normalizeWhitespace(page.title) || '(untitled)'}`, `Site: ${normalizeWhitespace(page.siteName) || '(unknown)'}`];
  if (summary) lines.push('', 'Summary of the article:', normalizeWhitespace(summary.english));
  return lines.join('\n');
}

function retryLine(hint: string | undefined): string {
  return hint ? `\n\nYour previous answer was rejected: ${hint}. Follow the field rules exactly.` : '';
}

function selectedLine(req: LookupRequest): string {
  const byIndex = new Map(req.passage.tokens.map((t) => [t.i, t.t]));
  return req.selectedIndices.map((i) => `[${i}]${byIndex.get(i) ?? ''}`).join(' ');
}

export function dictionaryUserMessage(req: LookupRequest, retryHint?: string): string {
  const sentence = req.passage.sentence
    ? normalizeWhitespace(req.passage.text.slice(req.passage.sentence.start, req.passage.sentence.end))
    : normalizeWhitespace(req.passage.text);
  return [
    'Paragraph:',
    '"""',
    req.paragraph,
    '"""',
    '',
    'Numbered passage:',
    '"""',
    buildNumberedPassage(req.passage),
    '"""',
    '',
    `Sentence containing the selection: "${sentence}"`,
    `Selected: ${selectedLine(req)}`,
    `Selected text: "${normalizeWhitespace(req.selection)}"`,
  ].join('\n') + retryLine(retryHint);
}

export function translationUserMessage(req: LookupRequest, retryHint?: string): string {
  return [
    'Paragraph around the selection (context only):',
    '"""',
    req.paragraph,
    '"""',
    '',
    'The selection, as a numbered passage:',
    '"""',
    buildNumberedPassage(req.passage),
    '"""',
  ].join('\n') + retryLine(retryHint);
}

export function summaryUserMessage(input: { title: string; siteName: string; text: string }): string {
  return [
    `Title: ${normalizeWhitespace(input.title)}`,
    `Site: ${normalizeWhitespace(input.siteName)}`,
    '',
    'Article text:',
    '"""',
    input.text,
    '"""',
  ].join('\n');
}
