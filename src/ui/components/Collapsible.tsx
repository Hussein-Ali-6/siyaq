import { useState, type ReactNode } from 'react';
import { ChevronIcon } from './icons';

export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-text"
        aria-expanded={open}
      >
        <ChevronIcon open={open} />
        {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
