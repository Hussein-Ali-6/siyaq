import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { LANGUAGES, NO_TRANSLATION, languageIdFromName, otherLanguageName, type Language } from '@/lib/languages';
import { getPrefs, setPrefs } from '@/lib/storage/settings';
import type { Level, Prefs } from '@/lib/types';

const OTHER = 'other';
const LEVELS: Array<{ id: Level; label: string }> = [
  { id: 'B1', label: 'Intermediate (B1)' },
  { id: 'B2', label: 'Upper-intermediate (B2)' },
  { id: 'C1', label: 'Advanced (C1)' },
];
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
export function ReadingSection() {
  const [prefs, setLocalPrefs] = useState<Prefs | null>(null);
  // `previous` is the language that was stored before the "Other…" box was opened.
  const [other, setOther] = useState({ open: false, text: '', previous: NO_TRANSLATION });

  useEffect(() => {
    void getPrefs().then((p) => {
      setLocalPrefs(p);
      if (listChoice(p.language) === OTHER) setOther({ open: true, text: otherLanguageName(p.language) || p.language, previous: p.language });
    });
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes.prefs?.newValue) setLocalPrefs(changes.prefs.newValue as Prefs);
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  if (!prefs) return null;
  const choice = other.open ? OTHER : listChoice(prefs.language);

  const choose = (value: string) => {
    if (value !== OTHER) {
      setOther((o) => ({ ...o, open: false }));
      void setPrefs({ language: value });
      return;
    }
    setOther((o) => ({ ...o, open: true, previous: prefs.language }));
    // With an empty box nothing is saved and the previous choice stays.
    const id = languageIdFromName(other.text);
    if (id) void setPrefs({ language: id });
  };

  const typeOther = (text: string) => {
    setOther((o) => ({ ...o, open: true, text }));
    // Saved on every change. Emptying the box brings back the choice from before it was opened.
    void setPrefs({ language: languageForOtherText(text, other.previous) });
  };

  return (
    <div className="space-y-4 text-[13px]">
      <label className="block space-y-1.5">
        <span className="block font-medium">Translate into</span>
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
          <span className="block text-muted">Language name in English, for example Kurdish</span>
          <input className="input max-w-[360px]" value={other.text} maxLength={40} onChange={(e) => typeOther(e.target.value)} />
        </label>
      )}

      <fieldset className="space-y-1.5">
        <legend className="font-medium">My English level</legend>
        <div className="flex flex-wrap gap-4">
          {LEVELS.map((l) => (
            <label key={l.id} className="flex items-center gap-2">
              <input type="radio" name="level" checked={prefs.level === l.id} onChange={() => void setPrefs({ level: l.id })} className="accent-amber" />
              {l.label}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-muted">These apply to new lookups. Saved words keep the language they were saved in.</p>
    </div>
  );
}
