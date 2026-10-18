export function TriggerIcon({ x, y, onOpen }: { x: number; y: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      title="Look up with Siyaq"
      aria-label="Look up with Siyaq"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpen}
      className="absolute flex h-6 items-center rounded-full border border-border bg-surface px-2.5 text-[12px] font-semibold tracking-wide text-amber shadow-card transition-colors hover:border-amber"
      style={{ top: y, left: x }}
    >
      Siyaq
    </button>
  );
}
