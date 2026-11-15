import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckIcon } from '@/ui/components/icons';

const SHOWN_MS = 2000;
const SavedContext = createContext<() => void>(() => undefined);

/** Returns a function to call after a setting has been saved. It shows the shared "Saved" message. */
export const useSaved = () => useContext(SavedContext);

/**
 * Settings save themselves as soon as they change. This confirms each save in one place, at the bottom
 * of the window, so the reader never has to wonder whether a change was kept.
 */
export function SavedMessage({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback(() => {
    setShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), SHOWN_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <SavedContext.Provider value={show}>
      {children}
      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-10 flex justify-center">
        {shown && (
          <span className="saved-message flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-4 py-2 text-[13px] font-medium shadow-card">
            <CheckIcon className="h-3.5 w-3.5 text-amber" />
            Saved
          </span>
        )}
      </div>
    </SavedContext.Provider>
  );
}
