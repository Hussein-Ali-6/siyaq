import { Arabic } from '@/ui/components/Arabic';
import { Skeleton } from '@/ui/components/Skeleton';
import type { SummaryState } from './state';

export function SummaryView({ summary }: { summary: SummaryState }) {
  if (summary.status === 'ready' && summary.summary) {
    return (
      <div className="space-y-4">
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{summary.summary.english}</p>
        <Arabic className="whitespace-pre-wrap border-t border-border pt-3">{summary.summary.translation}</Arabic>
      </div>
    );
  }
  if (summary.status === 'error') {
    return <p className="text-[13px] text-muted">Summary unavailable: {summary.error?.message ?? 'unknown error'}</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">Summarising the article…</p>
      <Skeleton widths={['100%', '96%', '88%', '60%']} />
    </div>
  );
}
