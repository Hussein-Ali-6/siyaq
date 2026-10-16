import { Skeleton } from '@/ui/components/Skeleton';

export function LoadingView({ selection, kind }: { selection: string; kind: 'word' | 'sentence' }) {
  return (
    <div className="space-y-4">
      <p className={`line-clamp-3 text-[15px] ${kind === 'word' ? 'font-semibold' : 'text-muted'}`}>
        {kind === 'word' ? selection : `“${selection}”`}
      </p>
      <Skeleton widths={['88%', '100%', '64%']} />
      <Skeleton widths={['76%', '52%']} />
    </div>
  );
}
