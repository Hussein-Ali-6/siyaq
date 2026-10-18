import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { sendMessage } from '@/lib/messaging';
import { Arabic } from '@/ui/components/Arabic';
import { Skeleton } from '@/ui/components/Skeleton';
import { useTheme } from '@/ui/components/useTheme';
import type { SummaryState } from '@/ui/card/state';

interface ActiveTab {
  id: number;
  url: string;
  title: string;
}

export function App() {
  useTheme();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [tab, setTab] = useState<ActiveTab | null>(null);
  const [summary, setSummary] = useState<SummaryState>({ status: 'idle' });

  useEffect(() => {
    void (async () => {
      try {
        const status = await sendMessage('getStatus');
        setHasKey(status.hasKey);
        const [t] = await browser.tabs.query({ active: true, currentWindow: true });
        if (t?.id !== undefined && t.url && /^https?:/.test(t.url)) {
          setTab({ id: t.id, url: t.url, title: t.title ?? '' });
          const cached = await sendMessage('getSummary', t.url);
          if (cached) setSummary({ status: 'ready', summary: cached });
        }
      } catch {
        setHasKey(false);
      }
    })();
  }, []);

  async function summarize() {
    if (!tab) return;
    setSummary({ status: 'loading' });
    try {
      const article = await sendMessage('extractArticle', undefined, tab.id);
      if (!article) throw new Error('no article');
      const res = await sendMessage('summarize', { url: tab.url, title: article.title, siteName: article.siteName, text: article.text });
      setSummary(res.ok ? { status: 'ready', summary: res.summary } : { status: 'error', error: res.error });
    } catch {
      setSummary({
        status: 'error',
        error: { code: 'unknown', message: 'Siyaq is not running on this page. Reload the page and try again.' },
      });
    }
  }

  const openWords = () => void browser.tabs.create({ url: browser.runtime.getURL('/words.html') });
  const openOptions = () => void browser.runtime.openOptionsPage();

  return (
    <div className="flex w-[340px] flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold leading-none text-amber">Siyaq</h1>
        <button type="button" onClick={openOptions} className="text-[12px] text-muted hover:text-text">
          Settings
        </button>
      </header>

      {hasKey === false && (
        <div className="rounded-xl border border-amber/40 bg-amber-soft p-3 text-[13px]">
          <p className="font-medium">Add your Anthropic API key to start.</p>
          <button type="button" onClick={openOptions} className="btn-primary mt-2">
            Open settings
          </button>
        </div>
      )}

      <section className="space-y-2">
        <p className="label">Page summary</p>
        {!tab ? (
          <p className="text-[13px] text-muted">Open an article in a normal tab to summarise it.</p>
        ) : (
          <>
            <p className="truncate text-[13px] text-muted" title={tab.title}>
              {tab.title || tab.url}
            </p>
            {summary.status === 'ready' && summary.summary ? (
              <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-3">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{summary.summary.english}</p>
                <Arabic className="whitespace-pre-wrap border-t border-border pt-2 text-[13px]">{summary.summary.arabic}</Arabic>
              </div>
            ) : summary.status === 'loading' ? (
              <div className="rounded-xl border border-border bg-surface p-3">
                <Skeleton widths={['100%', '94%', '82%', '58%']} />
              </div>
            ) : (
              <div className="space-y-2">
                {summary.status === 'error' && <p className="text-[13px] text-danger">{summary.error?.message}</p>}
                <button type="button" onClick={summarize} className="btn-primary" disabled={hasKey === false}>
                  Summarise this page
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <footer className="flex items-center justify-between border-t border-border pt-3">
        <button type="button" onClick={openWords} className="btn">
          ★ My words
        </button>
        <span className="text-[11px] text-faint">Select text on a page to look it up</span>
      </footer>
    </div>
  );
}
