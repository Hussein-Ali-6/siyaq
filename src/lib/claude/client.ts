import Anthropic from '@anthropic-ai/sdk';
import type { ErrorCode } from '@/lib/types';
import type { JsonSchema } from '@/lib/claude/schemas';

export const MODEL = 'claude-sonnet-5-5';
export const REQUEST_TIMEOUT_MS = 30_000;
/** Medium lets the model judge notes and units more carefully than low; chosen 2026-10-18. */
export const EFFORT = 'medium' as const;
/** Re-run a safety-classifier decline on a fallback model server-side (Claude API only). */
export const USE_REFUSAL_FALLBACK = true;

export class ClaudeError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ClaudeError';
  }

  /** Transient failures worth one more attempt. */
  get retryable(): boolean {
    return this.code === 'rate_limited' || this.code === 'overloaded' || this.code === 'timeout' || this.code === 'network';
  }
}

export interface StructuredCall {
  /** Static instructions; cached. */
  system: string;
  /** Per-page context (title, site, summary); cached as a second breakpoint. */
  context: string;
  user: string;
  schema: JsonSchema;
  maxTokens: number;
  signal?: AbortSignal;
}

export interface StructuredResult {
  json: unknown;
  stopReason: string | null;
}

export interface ClaudeClient {
  callStructured(call: StructuredCall): Promise<StructuredResult>;
  /** A minimal request used to check that a key works. Throws a ClaudeError otherwise. */
  ping(): Promise<void>;
}

export function toClaudeError(err: unknown): ClaudeError {
  if (err instanceof ClaudeError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new ClaudeError('timeout', 'Claude took too long to answer.');
  if (err instanceof Anthropic.APIUserAbortError) return new ClaudeError('timeout', 'The request was cancelled.');
  if (err instanceof Anthropic.APIConnectionError) return new ClaudeError('network', 'Could not reach the Claude API. Check your connection.');
  if (err instanceof Anthropic.AuthenticationError) return new ClaudeError('bad_key', 'The API key was rejected.', 401);
  if (err instanceof Anthropic.PermissionDeniedError) return new ClaudeError('bad_key', 'This API key is not allowed to use the model.', 403);
  if (err instanceof Anthropic.RateLimitError) return new ClaudeError('rate_limited', 'Rate limit reached. Try again in a moment.', 429);
  if (err instanceof Anthropic.BadRequestError) return new ClaudeError('bad_request', `The API rejected the request: ${err.message}`, 400);
  if (err instanceof Anthropic.APIError) {
    const status = typeof err.status === 'number' ? err.status : undefined;
    if (status === 529 || (status !== undefined && status >= 500)) {
      return new ClaudeError('overloaded', 'Claude is overloaded right now. Try again shortly.', status);
    }
    return new ClaudeError('unknown', `API error${status ? ` (${status})` : ''}.`, status);
  }
  return new ClaudeError('unknown', 'Unexpected error while contacting Claude.');
}

export function createClaudeClient(apiKey: string): ClaudeClient {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
    timeout: REQUEST_TIMEOUT_MS,
  });

  return {
    async callStructured(call) {
      const params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming = {
        model: MODEL,
        max_tokens: call.maxTokens,
        system: [
          { type: 'text', text: call.system, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: call.context, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: call.user }],
        output_config: { effort: EFFORT, format: { type: 'json_schema', schema: call.schema } },
      };
      if (USE_REFUSAL_FALLBACK) {
        params.betas = ['server-side-fallback-2026-07-01'];
        params.fallbacks = 'default';
      }

      let response: Anthropic.Beta.Messages.BetaMessage;
      try {
        response = await client.beta.messages.create(params, { signal: call.signal ?? undefined });
      } catch (err) {
        throw toClaudeError(err);
      }

      if (response.stop_reason === 'refusal') {
        throw new ClaudeError('refused', 'Claude declined to answer this request.');
      }
      if (response.stop_reason === 'max_tokens') {
        throw new ClaudeError('invalid_answer', 'the answer was cut off before it was complete');
      }
      const text = response.content
        .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new ClaudeError('invalid_answer', 'the answer was not valid JSON');
      }
      return { json, stopReason: response.stop_reason };
    },

    async ping() {
      try {
        await client.messages.create({
          model: MODEL,
          max_tokens: 8,
          output_config: { effort: 'low' },
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        });
      } catch (err) {
        throw toClaudeError(err);
      }
    },
  };
}
