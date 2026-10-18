export function TriggerIcon({ x, y, onOpen }: { x: number; y: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      title="Look up with Siyaq"
      aria-label="Look up with Siyaq"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onOpen}
      className="absolute flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-amber shadow-card transition-colors hover:border-amber"
      style={{ top: y, left: x }}
    >
      <span className="font-arabic text-[22px] font-bold leading-none" aria-hidden="true" style={{ lineHeight: 1, marginTop: '-0.15em' }}>
        س
      </span>
    </button>
  );
}
