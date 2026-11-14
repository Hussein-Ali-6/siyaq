import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { LANGUAGES, NO_TRANSLATION, languageIdFromName, otherLanguageName } from '@/lib/languages';
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

/** The translation language and the reading level. Both are saved as soon as they change. */
export function ReadingSection() {
  const [prefs, setLocalPrefs] = useState<Prefs | null>(null);
  const [other, setOther] = useState({ open: false, text: '' });

  useEffect(() => {
    void getPrefs().then((p) => {
      setLocalPrefs(p);
      if (listChoice(p.language) === OTHER) setOther({ open: true, text: otherLanguageName(p.language) || p.language });
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
    setOther((o) => ({ ...o, open: true }));
    // With an empty box nothing is saved and the previous choice stays.
    const id = languageIdFromName(other.text);
    if (id) void setPrefs({ language: id });
  };

  const typeOther = (text: string) => {
    setOther({ open: true, text });
    const id = languageIdFromName(text);
    if (id) void setPrefs({ language: id });
  };

  return (
    <div className="space-y-4 text-[13px]">
      <label className="block space-y-1.5">
        <span className="block font-medium">Translate into</span>
        <select className="input max-w-[360px]" value={choice} onChange={(e) => choose(e.target.value)}>
          <option value={NO_TRANSLATION}>English only (no translation)</option>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nativeName} · {l.englishName}
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
