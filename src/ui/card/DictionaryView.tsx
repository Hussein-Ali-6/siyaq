import type { DictionaryCard, Segment } from '@/lib/types';
import { Arabic } from '@/ui/components/Arabic';
import { BlurReveal } from '@/ui/components/BlurReveal';
import { Collapsible } from '@/ui/components/Collapsible';

export function SentenceText({ segments, sentence }: { segments?: Segment[]; sentence?: string }) {
  if (segments && segments.length) {
    return (
      <>
        {segments.map((s, i) =>
          s.bold ? (
            <strong key={i} className="font-semibold text-amber-strong">
              {s.text}
            </strong>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </>
    );
  }
  return <>{sentence}</>;
}

/** The Arabic for this sense. Cards saved while the explanation was separate also show it. */
export function ArabicMeaning({ card, className = '' }: { card: DictionaryCard; className?: string }) {
  return (
    <div dir="rtl" lang="ar" className={`arabic ${className}`}>
      <p className="text-[16px] font-medium">{card.arabic}</p>
      {card.arabicMeaning && <p className="text-[14px] leading-relaxed">{card.arabicMeaning}</p>}
    </div>
  );
}

export function DictionaryView({ card, segments, sentence }: { card: DictionaryCard; segments?: Segment[]; sentence?: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-[15px] leading-snug">{card.meaning}</p>
        <ArabicMeaning card={card} />
      </div>

      {card.notes.length > 0 && (
        <section className="space-y-1.5">
          <p className="label">Good to know</p>
          <ul className="space-y-1 text-[13px] leading-snug">
            {card.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber" aria-hidden="true" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl bg-surface-2 p-3">
        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text">
          <SentenceText segments={segments} sentence={sentence} />
        </p>
        <div className="mt-2 border-t border-border pt-2">
          <BlurReveal>
            <Arabic className="text-[14px]">{card.sentenceArabic}</Arabic>
          </BlurReveal>
        </div>
      </section>

      {card.examples.length > 0 && (
        <section className="space-y-1.5">
          <p className="label">Examples</p>
          <ul className="space-y-1 text-[13px] leading-snug text-muted">
            {card.examples.map((e, i) => (
              <li key={i} className="border-l-2 border-border pl-2.5">
                {e}
              </li>
            ))}
          </ul>
        </section>
      )}

      {card.combinations.length > 0 && (
        <section className="space-y-1.5">
          <p className="label">Common combinations</p>
          <div className="flex flex-wrap gap-1.5">
            {card.combinations.map((c, i) => (
              <span key={i} className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[12.5px]">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {card.otherMeanings.length > 0 && (
        <Collapsible title={`Other meanings (${card.otherMeanings.length})`}>
          <ul className="space-y-2 text-[13px]">
            {card.otherMeanings.map((m, i) => (
              <li key={i} className="flex flex-col gap-0.5 border-l-2 border-border pl-2.5">
                <span>{m.meaning}</span>
                <Arabic as="span" className="text-[13px] text-muted">
                  {m.arabic}
                </Arabic>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}
