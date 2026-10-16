import { useState, type ReactNode } from 'react';

/** Content blurred until clicked, so the reader can try first. */
export function BlurReveal({ children, hint = 'Show translation' }: { children: ReactNode; hint?: string }) {
  const [shown, setShown] = useState(false);
  if (shown) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      className="relative block w-full cursor-pointer text-left"
      aria-label={hint}
    >
      <div className="select-none blur-[6px]" aria-hidden="true">
        {children}
      </div>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full border border-border bg-surface/90 px-3 py-1 text-xs font-medium text-muted">{hint}</span>
      </span>
    </button>
  );
}
