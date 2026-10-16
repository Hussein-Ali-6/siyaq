import type { UserError } from '@/lib/types';

const TITLES: Record<UserError['code'], string> = {
  no_key: 'No API key yet',
  bad_key: 'API key rejected',
  rate_limited: 'Too many requests',
  overloaded: 'Claude is busy',
  timeout: 'That took too long',
  network: 'No connection',
  invalid_answer: 'Unusable answer',
  refused: 'Request declined',
  bad_request: 'Request rejected',
  too_long: 'Selection too long',
  unknown: 'Something went wrong',
};

export function ErrorView({ error, onRetry, onSettings }: { error: UserError; onRetry: () => void; onSettings: () => void }) {
  const needsKey = error.code === 'no_key' || error.code === 'bad_key';
  return (
    <div className="space-y-3">
      <p className="font-semibold text-danger">{TITLES[error.code]}</p>
      <p className="text-[13px] text-muted">{error.message}</p>
      <div className="flex gap-2">
        {needsKey ? (
          <button type="button" onClick={onSettings} className="rounded-lg bg-amber px-3 py-1.5 text-[13px] font-semibold text-bg hover:bg-amber-strong">
            Open settings
          </button>
        ) : (
          error.code !== 'too_long' && (
            <button type="button" onClick={onRetry} className="rounded-lg bg-amber px-3 py-1.5 text-[13px] font-semibold text-bg hover:bg-amber-strong">
              Try again
            </button>
          )
        )}
      </div>
    </div>
  );
}
