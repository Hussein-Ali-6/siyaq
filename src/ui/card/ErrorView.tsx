import { CHATGPT_USAGE_URL } from '@/lib/auth/chatgpt-oauth';
import type { UserError } from '@/lib/types';

const TITLES: Record<UserError['code'], string> = {
  no_key: 'Setup needed',
  bad_key: 'API key rejected',
  rate_limited: 'Too many requests',
  overloaded: 'Claude is busy',
  timeout: 'That took too long',
  network: 'No connection',
  invalid_answer: 'Unusable answer',
  refused: 'Request declined',
  bad_request: 'Request rejected',
  too_long: 'Selection too long',
  usage_limit: 'ChatGPT plan limit reached',
  signed_out: 'Signed out of ChatGPT',
  not_eligible: 'ChatGPT plan not available',
  unknown: 'Something went wrong',
};

const NEEDS_SETTINGS = new Set<UserError['code']>(['no_key', 'bad_key', 'signed_out', 'not_eligible']);

export function ErrorView({ error, onRetry, onSettings }: { error: UserError; onRetry: () => void; onSettings: () => void }) {
  const needsSettings = NEEDS_SETTINGS.has(error.code);
  return (
    <div className="space-y-3">
      <p className="font-semibold text-danger">{TITLES[error.code]}</p>
      <p className="text-[13px] text-muted">{error.message}</p>
      <div className="flex gap-2">
        {error.code === 'usage_limit' ? (
          <a href={CHATGPT_USAGE_URL} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-amber px-3 py-1.5 text-[13px] font-semibold text-bg no-underline hover:bg-amber-strong">
            Manage usage
          </a>
        ) : needsSettings ? (
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
