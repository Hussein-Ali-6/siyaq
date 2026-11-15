import { useState } from 'react';
import { LANGUAGES, NO_TRANSLATION, languageIdFromName, otherLanguageName, type Language } from '@/lib/languages';
import { setPrefs } from '@/lib/storage/settings';
import type { Level, Prefs } from '@/lib/types';
import { useSaved } from './saved-message';

const OTHER = 'other';

/**
 * The levels as the reader sees them. Each `help` says who the level is for and what the cards do at
 * it, following the level rules in src/lib/llm/prompts.ts.
 */
export const LEVELS: ReadonlyArray<{ id: Level; name: string; help: string }> = [
  { id: 'B1', name: 'Intermediate', help: 'Everyday English is fine, but articles are hard work. Cards use very simple words and restate every sentence you select in plainer English.' },
  { id: 'B2', name: 'Upper-intermediate', help: 'You follow most articles and get stuck on idioms and less common words. Cards explain those in clear English.' },
  { id: 'C1', name: 'Advanced', help: 'You read with ease. Cards skip what you already know and explain only rare words and tricky phrases.' },
];

/** A level as one phrase, such as "Upper-intermediate (B2)". */
export function levelLabel(level: Level): string {
  return `${LEVELS.find((l) => l.id === level)?.name ?? level} (${level})`;
}

const listed = new Set(LANGUAGES.map((l) => l.id));

/** Which entry of the list a stored language id selects. */
export function listChoice(language: string): string {
  return language === NO_TRANSLATION || listed.has(language) ? language : OTHER;
}

/**
 * The language to store for the text in the "Other…" box. `previous` is the language that was stored
 * before the box was opened. An empty box means that choice stays. When that choice was itself a
 * typed language, the reader has just deleted it, and the result is English only.
 */
export function languageForOtherText(text: string, previous: string): string {
  const typed = languageIdFromName(text);
  if (typed) return typed;
  return listChoice(previous) === OTHER ? NO_TRANSLATION : previous;
}

/** How a listed language is shown: its own name and its English name, or one name when they are the same. */
export function optionLabel(language: Pick<Language, 'nativeName' | 'englishName'>): string {
  return language.nativeName === language.englishName ? language.nativeName : `${language.nativeName} · ${language.englishName}`;
}

/** The translation language and the reading level. Both are saved as soon as they change. */
export function ReadingSection({ prefs }: { prefs: Prefs }) {
  const saved = useSaved();
  // `previous` is the language that was stored before the "Other…" box was opened.
  const [other, setOther] = useState(() =>
    listChoice(prefs.language) === OTHER ? { open: true, text: otherLanguageName(prefs.language) || prefs.language, previous: prefs.language } : { open: false, text: '', previous: NO_TRANSLATION },
  );
  const choice = other.open ? OTHER : listChoice(prefs.language);
  const save = (update: Partial<Prefs>) => void setPrefs(update).then(saved);

  const choose = (value: string) => {
    if (value !== OTHER) {
      setOther((o) => ({ ...o, open: false }));
      save({ language: value });
      return;
    }
    setOther((o) => ({ ...o, open: true, previous: prefs.language }));
    // With an empty box nothing is saved and the previous choice stays.
    const id = languageIdFromName(other.text);
    if (id) save({ language: id });
  };

  const typeOther = (text: string) => {
    setOther((o) => ({ ...o, open: true, text }));
    // Saved on every change. Emptying the box brings back the choice from before it was opened.
    save({ language: languageForOtherText(text, other.previous) });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="block text-[14px] font-medium">Translate into</span>
          <select className="input max-w-[360px]" value={choice} onChange={(e) => choose(e.target.value)}>
            <option value={NO_TRANSLATION}>English only (no translation)</option>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {optionLabel(l)}
              </option>
            ))}
            <option value={OTHER}>Other…</option>
          </select>
        </label>

        {choice === OTHER && (
          <label className="block space-y-1.5">
            <span className="block text-[13px] text-muted">Language name in English, for example Kurdish</span>
            <input className="input max-w-[360px]" value={other.text} maxLength={40} onChange={(e) => typeOther(e.target.value)} />
          </label>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[14px] font-medium">My English level</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <label
              key={l.id}
              className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-border p-3 hover:border-faint has-[:checked]:border-amber has-[:checked]:bg-amber-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber"
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="level" checked={prefs.level === l.id} onChange={() => save({ level: l.id })} className="accent-amber outline-none" />
                <span className="text-[14px] font-semibold">{l.name}</span>
                <span className="ml-auto text-[12px] text-muted">{l.id}</span>
              </span>
              <span className="text-[13px] leading-snug text-muted">{l.help}</span>
            </label>
          ))}
        </div>
        <p className="text-[13px] text-muted">Not sure? Start with Upper-intermediate. You can change it at any time.</p>
      </fieldset>

      <p className="text-[13px] text-muted">Both apply to new lookups. Saved words keep the language they were saved in.</p>
    </div>
  );
}
