import type { DictionaryCard, Segment } from '@/lib/types';
import { Translated } from '@/ui/components/Translated';
import { BlurReveal } from '@/ui/components/BlurReveal';
import { Collapsible } from '@/ui/components/Collapsible';
import { Pronunciation } from '@/ui/components/Pronunciation';

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

/** This sense in the reader's language. Cards saved while the explanation was separate also show it, and some of them have only the explanation. */
export function TranslatedMeaning({ card, className = '' }: { card: DictionaryCard; className?: string }) {
  if (!card.translation && !card.translationNote) return null;
  return (
    <Translated as="div" language={card.language} className={className}>
      {card.translation && <p className="text-[16px] font-medium">{card.translation}</p>}
      {card.translationNote && <p className="text-[14px] leading-relaxed">{card.translationNote}</p>}
    </Translated>
  );
}

export function DictionaryView({ card, segments, sentence }: { card: DictionaryCard; segments?: Segment[]; sentence?: string }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Pronunciation text={card.headword} ipaUk={card.ipaUk} ipaUs={card.ipaUs} />
        <p className="text-[15px] leading-snug">{card.meaning}</p>
        <TranslatedMeaning card={card} />
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
        {card.sentenceTranslation && (
          <div className="mt-2 border-t border-border pt-2">
            <BlurReveal>
              <Translated language={card.language} className="text-[14px]">
                {card.sentenceTranslation}
              </Translated>
            </BlurReveal>
          </div>
        )}
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
                {m.translation && (
                  <Translated as="span" language={card.language} className="text-[13px] text-muted">
                    {m.translation}
                  </Translated>
                )}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}
