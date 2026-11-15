import { useId, type ReactNode } from 'react';

/** One titled block of the settings page. `aside` sits to the right of the title, for a block with one control. */
export function Section({ id, title, intro, aside, children }: { id: string; title: string; intro?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id={`${id}-title`} className="text-[16px] font-semibold">
            {title}
          </h2>
          {aside}
        </div>
        {intro && <p className="text-[13px] text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

/** A choice between a few short options, shown side by side. Real radio buttons, so arrow keys work. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<{ id: T; label: string }>; value: T; onChange: (value: T) => void }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-[13px]">
      {options.map((o) => (
        <label
          key={o.id}
          className="cursor-pointer rounded-md px-4 py-1 text-muted hover:text-text has-[:checked]:bg-amber-soft has-[:checked]:font-semibold has-[:checked]:text-amber has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber"
        >
          <input type="radio" name={name} className="sr-only" checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export type Note = { ok: boolean; text: string } | null;

/** The result of an action, shown where the action was taken. */
export function NoteBox({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p role="status" className={`rounded-lg border px-3 py-2 text-[13px] ${note.ok ? 'border-amber/50 bg-amber-soft' : 'border-danger/60 bg-danger/10'}`}>
      {note.text}
    </p>
  );
}
