/**
 * The translation languages Siyaq offers, and the one place that knows about languages.
 *
 * A language id is stored wherever a language is recorded: "none" (English only), a listed code
 * such as "ar" or "pt-BR", or "x:<name>" for a language the reader typed, such as "x:Kurdish".
 */
export interface Language {
  /** BCP 47 code, also used as the HTML lang attribute. */
  id: string;
  nativeName: string;
  /** The name in the list and in exports. Also the name used in prompts, unless `promptName` is set. */
  englishName: string;
  /** The name used in prompts when the list name would read badly inside a sentence. */
  promptName?: string;
  dir: 'ltr' | 'rtl';
  /** Unicode script names, "|"-separated. Absent means translations get no script check. */
  script?: string;
  /** The written standard to ask the model for. */
  variety?: string;
}

export const NO_TRANSLATION = 'none';
const OTHER_PREFIX = 'x:';
const MAX_OTHER_NAME = 40;

/** Sorted by English name. */
export const LANGUAGES: readonly Language[] = [
  { id: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', script: 'Arabic', variety: 'Modern Standard Arabic' },
  { id: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', dir: 'ltr', script: 'Bengali' },
  { id: 'bg', nativeName: 'Български', englishName: 'Bulgarian', dir: 'ltr', script: 'Cyrillic' },
  { id: 'zh-Hans', nativeName: '简体中文', englishName: 'Chinese (Simplified)', promptName: 'Simplified Chinese', dir: 'ltr', script: 'Han' },
  { id: 'zh-Hant', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', promptName: 'Traditional Chinese', dir: 'ltr', script: 'Han' },
  { id: 'cs', nativeName: 'Čeština', englishName: 'Czech', dir: 'ltr' },
  { id: 'da', nativeName: 'Dansk', englishName: 'Danish', dir: 'ltr' },
  { id: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', dir: 'ltr' },
  { id: 'fil', nativeName: 'Filipino', englishName: 'Filipino', dir: 'ltr' },
  { id: 'fi', nativeName: 'Suomi', englishName: 'Finnish', dir: 'ltr' },
  { id: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { id: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { id: 'el', nativeName: 'Ελληνικά', englishName: 'Greek', dir: 'ltr', script: 'Greek' },
  { id: 'he', nativeName: 'עברית', englishName: 'Hebrew', dir: 'rtl', script: 'Hebrew' },
  { id: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', script: 'Devanagari' },
  { id: 'hu', nativeName: 'Magyar', englishName: 'Hungarian', dir: 'ltr' },
  { id: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr' },
  { id: 'it', nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr' },
  { id: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr', script: 'Han|Hiragana|Katakana' },
  { id: 'ko', nativeName: '한국어', englishName: 'Korean', dir: 'ltr', script: 'Hangul' },
  { id: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', dir: 'ltr' },
  { id: 'nb', nativeName: 'Norsk', englishName: 'Norwegian', dir: 'ltr' },
  { id: 'fa', nativeName: 'فارسی', englishName: 'Persian', dir: 'rtl', script: 'Arabic' },
  { id: 'pl', nativeName: 'Polski', englishName: 'Polish', dir: 'ltr' },
  { id: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', promptName: 'Brazilian Portuguese', dir: 'ltr' },
  { id: 'pt-PT', nativeName: 'Português (Portugal)', englishName: 'Portuguese (Portugal)', promptName: 'European Portuguese', dir: 'ltr' },
  { id: 'ro', nativeName: 'Română', englishName: 'Romanian', dir: 'ltr' },
  { id: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr', script: 'Cyrillic' },
  // Serbian is written in Cyrillic and in Latin, so it gets no script check.
  { id: 'sr', nativeName: 'Српски', englishName: 'Serbian', dir: 'ltr' },
  { id: 'sk', nativeName: 'Slovenčina', englishName: 'Slovak', dir: 'ltr' },
  { id: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { id: 'sw', nativeName: 'Kiswahili', englishName: 'Swahili', dir: 'ltr' },
  { id: 'sv', nativeName: 'Svenska', englishName: 'Swedish', dir: 'ltr' },
  { id: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', dir: 'ltr', script: 'Tamil' },
  { id: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', dir: 'ltr', script: 'Telugu' },
  { id: 'th', nativeName: 'ไทย', englishName: 'Thai', dir: 'ltr', script: 'Thai' },
  { id: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { id: 'uk', nativeName: 'Українська', englishName: 'Ukrainian', dir: 'ltr', script: 'Cyrillic' },
  { id: 'ur', nativeName: 'اردو', englishName: 'Urdu', dir: 'rtl', script: 'Arabic' },
  { id: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr' },
];

export interface ResolvedLanguage {
  id: string;
  /** The language's own name, or the typed name. */
  label: string;
  /** The English name used in prompts, or the typed name. */
  promptName: string;
  dir: 'ltr' | 'rtl' | 'auto';
  /** HTML lang attribute. Absent for typed languages. */
  lang?: string;
  script?: string;
  variety?: string;
}

const byId = new Map(LANGUAGES.map((l) => [l.id.toLowerCase(), l]));

/** The typed name inside an "x:" id, or an empty string for any other id. */
export function otherLanguageName(id: string): string {
  return id.startsWith(OTHER_PREFIX) ? id.slice(OTHER_PREFIX.length) : '';
}

/** Builds the id for a language the reader typed. Null when nothing usable was typed. */
export function otherLanguageId(name: string): string | null {
  const clean = name.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
  // Cut by code point, so a character that takes two code units is kept whole or left out.
  const cut = Array.from(clean).slice(0, MAX_OTHER_NAME).join('').trim();
  return cut ? OTHER_PREFIX + cut : null;
}

/** The id for a language name typed by the reader: the listed language when the name is one of the list's names, English only for "English", otherwise a typed language. Null when the name is empty. */
export function languageIdFromName(name: string): string | null {
  const typed = otherLanguageId(name);
  if (!typed) return null;
  const clean = typed.slice(OTHER_PREFIX.length).toLowerCase();
  if (clean === 'english') return NO_TRANSLATION;
  const match = LANGUAGES.find((l) => [l.englishName, l.nativeName, l.promptName].some((n) => n?.toLowerCase() === clean));
  return match ? match.id : typed;
}

/** Details of a listed or typed language. Not meant for "none". An unknown code is treated as a typed name. */
export function resolveLanguage(id: string): ResolvedLanguage {
  const listed = byId.get(id.toLowerCase());
  if (listed) {
    return {
      id: listed.id,
      label: listed.nativeName,
      promptName: listed.promptName ?? listed.englishName,
      dir: listed.dir,
      lang: listed.id,
      ...(listed.script ? { script: listed.script } : {}),
      ...(listed.variety ? { variety: listed.variety } : {}),
    };
  }
  const name = otherLanguageName(id) || id;
  return { id, label: name, promptName: name, dir: 'auto' };
}

/** For exports: the English name as the list shows it, the typed name, or "English only". */
export function languageName(id: string): string {
  if (id === NO_TRANSLATION) return 'English only';
  return byId.get(id.toLowerCase())?.englishName ?? resolveLanguage(id).promptName;
}

/** For the reader: the language's own name, the typed name, or "English only". */
export function languageLabel(id: string): string {
  return id === NO_TRANSLATION ? 'English only' : resolveLanguage(id).label;
}

/** True when `text` has at least one character of the given scripts, such as "Han|Hiragana". */
export function hasScript(text: string, script: string): boolean {
  const pattern = script
    .split('|')
    .map((s) => `\\p{Script=${s}}`)
    .join('|');
  return new RegExp(pattern, 'u').test(text);
}

/** The language a new install starts with, from the browser's interface language. */
export function languageFromBrowser(uiLanguage: string): string {
  const tag = uiLanguage.trim().replace(/_/g, '-').toLowerCase();
  const base = tag.split('-')[0] ?? '';
  if (base === 'zh') return /-(tw|hk|mo|hant)(-|$)/.test(tag) ? 'zh-Hant' : 'zh-Hans';
  if (base === 'pt') return tag === 'pt-pt' ? 'pt-PT' : 'pt-BR';
  if (base === 'no' || base === 'nn') return 'nb';
  if (base === 'tl') return 'fil';
  return byId.get(tag)?.id ?? byId.get(base)?.id ?? NO_TRANSLATION;
}
