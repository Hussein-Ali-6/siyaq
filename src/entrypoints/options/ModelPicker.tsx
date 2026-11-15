import { useEffect, useMemo, useState } from 'react';
import { sendMessage } from '@/lib/messaging';
import type { ModelOption } from '@/lib/llm/models';
import type { ProviderId } from '@/lib/llm/types';

type State = { status: 'loading' } | { status: 'ready'; models: ModelOption[]; recommended: string | null } | { status: 'error'; message: string };

/**
 * The provider's live model list, searchable, with the recommended model marked and a box for an ID
 * that is not in the list. `onChange` gets `byReader` false when the picker itself chose the
 * recommended model because none was chosen.
 */
export function ModelPicker({ provider, value, onChange }: { provider: ProviderId; value: string; onChange: (model: string, byReader: boolean) => void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
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
    if (!value && res.recommended) onChange(res.recommended, false);
  };

  useEffect(() => {
    setQuery('');
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const visible = useMemo(() => {
    if (state.status !== 'ready') return [];
    const q = query.trim().toLowerCase();
    const list = q ? state.models.filter((m) => m.id.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)) : state.models;
    return list.slice(0, 200);
  }, [state, query]);

  return (
    <div className="space-y-2">
      {state.status === 'loading' && <p className="text-[13px] text-muted">Loading models…</p>}
      {state.status === 'error' && <p className="text-[13px] text-danger">{state.message}</p>}
      {state.status === 'ready' && (
        <>
          {state.models.length > 8 && <input className="input" placeholder={`Search ${state.models.length} models…`} aria-label="Search models" value={query} onChange={(e) => setQuery(e.target.value)} />}
          <ul className="scroll-thin max-h-[260px] overflow-y-auto rounded-xl border border-border bg-surface p-1" role="listbox" aria-label="Models">
            {visible.length === 0 && <li className="px-3 py-2 text-[13px] text-muted">No models match.</li>}
            {visible.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m.id === value}
                  onClick={() => onChange(m.id, true)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-[13px] ${m.id === value ? 'bg-amber-soft text-amber' : 'hover:bg-surface-2'}`}
                >
                  <span className="min-w-0 truncate">
                    {m.label}
                    {m.label !== m.id && <span className="ml-2 font-mono text-[12px] text-muted">{m.id}</span>}
                  </span>
                  {m.id === state.recommended && <span className="shrink-0 rounded-full border border-amber/50 px-2 py-0.5 text-[12px] font-medium text-amber">Recommended</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) onChange(custom.trim(), true);
          setCustom('');
        }}
      >
        <input className="input min-w-[200px] flex-1 font-mono text-[13px]" placeholder="Not in the list? Type a model ID" aria-label="Model ID" value={custom} onChange={(e) => setCustom(e.target.value)} spellCheck={false} />
        <button type="submit" className="btn shrink-0" disabled={!custom.trim()}>
          Use ID
        </button>
        <button type="button" className="btn shrink-0" onClick={() => void load()} disabled={state.status === 'loading'}>
          Refresh list
        </button>
      </form>
    </div>
  );
}
