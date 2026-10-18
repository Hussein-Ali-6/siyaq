import { useState } from 'react';
import type { TranslationCard } from '@/lib/types';
import { Arabic } from '@/ui/components/Arabic';
import { SpeakButton } from '@/ui/components/SpeakButton';

export function TranslationView({
  card,
  selection,
  onKeyExpression,
}: {
  card: TranslationCard;
  selection: string;
  onKeyExpression: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = selection.length > 220;
  return (
    <div className="space-y-4">
      <div>
        <p className={`whitespace-pre-wrap text-[13px] leading-relaxed text-muted ${expanded ? '' : 'line-clamp-3'}`}>{selection}</p>
        <div className="mt-1 flex items-center gap-1">
          {long && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="mr-2 text-[12px] font-medium text-amber hover:text-amber-strong">
              {expanded ? 'Show less' : 'Show all'}
            </button>
          )}
          <SpeakButton text={selection} accent="uk" label="UK" />
          <SpeakButton text={selection} accent="us" label="US" />
        </div>
      </div>

      <Arabic className="whitespace-pre-wrap text-[15px]">{card.arabic}</Arabic>

      {card.plainEnglish && (
        <section className="space-y-1.5">
          <p className="label">In plain English</p>
          <p className="text-[13.5px] leading-relaxed">{card.plainEnglish}</p>
        </section>
      )}

      {card.keyExpressions.length > 0 && (
        <section className="space-y-1.5">
          <p className="label">Key expressions</p>
          <ul className="space-y-1.5">
            {card.keyExpressions.map((k, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onKeyExpression(i)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-left hover:border-amber"
                  title="Open dictionary card"
                >
                  <span className="font-semibold text-amber">{k.expression}</span>
                  <span className="text-muted"> · </span>
                  <span className="text-[13px]">{k.meaning}</span>
                  <Arabic as="span" className="ml-2 inline-block text-[13px] text-muted">
                    {k.arabic}
                  </Arabic>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
