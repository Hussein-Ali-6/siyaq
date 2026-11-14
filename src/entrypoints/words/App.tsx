import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { languageLabel } from '@/lib/languages';
import { listSaved, removeSaved, searchSaved, toCsv, toJson } from '@/lib/storage/saved';
import type { SavedItem } from '@/lib/types';
import { SentenceText, TranslatedMeaning } from '@/ui/card/DictionaryView';
import { ExternalIcon, TrashIcon } from '@/ui/components/icons';
import { LookupLinks } from '@/ui/components/LookupLinks';
import { Pronunciation } from '@/ui/components/Pronunciation';
import { SpeakButton } from '@/ui/components/SpeakButton';
import { Translated } from '@/ui/components/Translated';
import { useTheme } from '@/ui/components/useTheme';

type Filter = 'all' | 'word' | 'sentence';

function sourceLink(item: SavedItem): string {
  const snippet = item.sentence.trim().slice(0, 120);
  if (!snippet) return item.url;
  const base = item.url.split('#')[0] ?? item.url;
  return `${base}#:~:text=${encodeURIComponent(snippet)}`;
}

function download(name: string, text: string, type: string) {
  const blob = new Blob([type.includes('csv') ? `﻿${text}` : text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  useTheme();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const reload = () => void listSaved().then(setItems);

  useEffect(() => {
    reload();
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && 'saved' in changes) reload();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const visible = useMemo(() => {
    const byKind = filter === 'all' ? items : items.filter((i) => i.kind === filter);
    return searchSaved(byKind, query);
  }, [items, query, filter]);

  const counts = { all: items.length, word: items.filter((i) => i.kind === 'word').length, sentence: items.filter((i) => i.kind === 'sentence').length };
  // The language is shown on each item only when the list mixes languages.
  const showLanguage = new Set(items.map((i) => i.card.language)).size > 1;
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-[760px] px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-[22px] font-bold leading-none text-amber">Siyaq</span>
        <h1 className="text-[20px] font-semibold">My words</h1>
        <span className="text-[13px] text-muted">{items.length} saved</span>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn" onClick={() => download(`siyaq-${stamp}.json`, toJson(items), 'application/json')} disabled={!items.length}>
            Export JSON
          </button>
          <button type="button" className="btn" onClick={() => download(`siyaq-${stamp}.csv`, toCsv(items), 'text/csv;charset=utf-8')} disabled={!items.length}>
            Export CSV
          </button>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input className="input max-w-[360px]" placeholder="Search your words…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex rounded-lg border border-border bg-surface p-0.5 text-[13px]">
          {(['all', 'word', 'sentence'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 ${filter === f ? 'bg-amber-soft text-amber' : 'text-muted hover:text-text'}`}
            >
              {f === 'all' ? 'All' : f === 'word' ? 'Words' : 'Sentences'} <span className="text-faint">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-[13px] text-muted">
          {items.length === 0 ? 'Nothing saved yet. Open a card on any page and press ★ Save.' : 'No matches.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={item.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  {item.card.kind === 'word' ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-[17px] font-semibold text-amber">{item.card.headword}</span>
                        <span className="text-[12px] text-muted">{item.card.partOfSpeech}</span>
                      </div>
                      <Pronunciation text={item.card.headword} ipaUk={item.card.ipaUk} ipaUs={item.card.ipaUs} />
                      <p className="text-[14px]">{item.card.meaning}</p>
                      <TranslatedMeaning card={item.card} />
                      <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[13px] leading-relaxed">
                        <SentenceText segments={item.sentenceSegments} sentence={item.sentence} />
                      </p>
                      {item.card.sentenceTranslation && (
                        <Translated language={item.card.language} className="text-[13px] text-muted">
                          {item.card.sentenceTranslation}
                        </Translated>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{item.selection}</p>
                      <div className="flex items-center gap-1">
                        <SpeakButton text={item.selection} accent="uk" label="UK" />
                        <SpeakButton text={item.selection} accent="us" label="US" />
                      </div>
                      {item.card.translation ? (
                        <Translated language={item.card.language} className="whitespace-pre-wrap text-[14px]">
                          {item.card.translation}
                        </Translated>
                      ) : (
                        <p className="text-[14px] leading-relaxed">{item.card.plainEnglish}</p>
                      )}
                    </>
                  )}
                  <p className="flex flex-wrap items-center gap-x-3 text-[12px] text-faint">
                    <a href={sourceLink(item)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-amber">
                      <ExternalIcon /> <span className="max-w-[320px] truncate">{item.pageTitle || item.url}</span>
                    </a>
                    <span>{new Date(item.savedAt).toLocaleDateString()}</span>
                    {showLanguage && <span>{languageLabel(item.card.language)}</span>}
                    {item.card.kind === 'word' && <LookupLinks headword={item.card.headword} />}
                  </p>
                </div>
                <button type="button" onClick={() => void removeSaved(item.id)} title="Delete" aria-label="Delete" className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-danger">
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
