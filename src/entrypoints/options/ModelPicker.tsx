import { useEffect, useMemo, useState } from 'react';
import { sendMessage } from '@/lib/messaging';
import type { ModelOption } from '@/lib/llm/models';
import type { ProviderId } from '@/lib/llm/types';

type State = { status: 'idle' | 'loading' } | { status: 'ready'; models: ModelOption[]; recommended: string | null } | { status: 'error'; message: string };

/** Live model list from the provider, searchable, with the recommended model marked and a custom ID option. */
export function ModelPicker({ provider, value, enabled, onChange }: { provider: ProviderId; value: string; enabled: boolean; onChange: (model: string) => void }) {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');

  const load = async () => {
    setState({ status: 'loading' });
    const res = await sendMessage('listModels', provider).catch(() => ({ ok: false as const, message: 'Could not reach the Siyaq background service.' }));
    if (!res.ok) {
      setState({ status: 'error', message: res.message });
      return;
    }
    setState({ status: 'ready', models: res.models, recommended: res.recommended });
    if (!value && res.recommended) onChange(res.recommended);
  };

  useEffect(() => {
    setQuery('');
    if (enabled) void load();
    else setState({ status: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, enabled]);

  const visible = useMemo(() => {
    if (state.status !== 'ready') return [];
    const q = query.trim().toLowerCase();
    const list = q ? state.models.filter((m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)) : state.models;
    return list.slice(0, 200);
  }, [state, query]);

  if (!enabled) return <p className="text-[13px] text-muted">Connect the provider first to choose a model.</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px]">
          Current: <span className="font-mono text-amber">{value || 'none chosen'}</span>
        </p>
        <button type="button" className="text-[12px] text-muted hover:text-text" onClick={() => void load()}>
          Refresh list
        </button>
      </div>
      {state.status === 'loading' && <p className="text-[13px] text-muted">Loading models…</p>}
      {state.status === 'error' && <p className="text-[13px] text-danger">{state.message}</p>}
      {state.status === 'ready' && (
        <>
          {state.models.length > 8 && <input className="input" placeholder={`Search ${state.models.length} models…`} value={query} onChange={(e) => setQuery(e.target.value)} />}
          <ul className="scroll-thin max-h-[260px] overflow-y-auto rounded-xl border border-border bg-surface-2 p-1" role="listbox" aria-label="Models">
            {visible.length === 0 && <li className="px-3 py-2 text-[13px] text-muted">No models match.</li>}
            {visible.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m.id === value}
                  onClick={() => onChange(m.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-[13px] ${m.id === value ? 'bg-amber-soft text-amber' : 'hover:bg-surface'}`}
                >
                  <span className="min-w-0 truncate">
                    {m.label}
                    {m.label !== m.id && <span className="ml-2 font-mono text-[11.5px] text-faint">{m.id}</span>}
                  </span>
                  {m.id === state.recommended && <span className="shrink-0 rounded-full border border-amber/50 px-2 py-0.5 text-[10.5px] font-semibold text-amber">Recommended</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) onChange(custom.trim());
          setCustom('');
        }}
      >
        <input className="input font-mono text-[13px]" placeholder="Or type a model ID" value={custom} onChange={(e) => setCustom(e.target.value)} spellCheck={false} />
        <button type="submit" className="btn shrink-0" disabled={!custom.trim()}>
          Use ID
        </button>
      </form>
    </div>
  );
}
