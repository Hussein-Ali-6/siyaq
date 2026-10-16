export function Skeleton({ widths = ['100%', '92%', '70%'] }: { widths?: string[] }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {widths.map((w, i) => (
        <div key={i} className="skeleton h-3" style={{ width: w }} />
      ))}
    </div>
  );
}
