import Anthropic from '@anthropic-ai/sdk';
import { LlmError, REQUEST_TIMEOUT_MS, parseJsonAnswer, type LlmClient, type Thinking } from '@/lib/llm/types';

/** Claude Sonnet 5.5: the model the prompts were tuned on. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';
/** Re-run a safety-classifier decline on a fallback model server-side (Claude API only). */
export const USE_REFUSAL_FALLBACK = true;

export function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new LlmError('timeout', 'Claude took too long to answer.');
  if (err instanceof Anthropic.APIUserAbortError) return new LlmError('timeout', 'The request was cancelled.');
  if (err instanceof Anthropic.APIConnectionError) return new LlmError('network', 'Could not reach the Claude API. Check your connection.');
  if (err instanceof Anthropic.AuthenticationError) return new LlmError('bad_key', 'The API key was rejected.', 401);
  if (err instanceof Anthropic.PermissionDeniedError) return new LlmError('bad_key', 'This API key is not allowed to use the model.', 403);
  if (err instanceof Anthropic.RateLimitError) return new LlmError('rate_limited', 'Rate limit reached. Try again in a moment.', 429);
  if (err instanceof Anthropic.BadRequestError) return new LlmError('bad_request', `The API rejected the request: ${err.message}`, 400);
  if (err instanceof Anthropic.APIError) {
    const status = typeof err.status === 'number' ? err.status : undefined;
    if (status === 529 || (status !== undefined && status >= 500)) {
      return new LlmError('overloaded', 'Claude is overloaded right now. Try again shortly.', status);
    }
    return new LlmError('unknown', `API error${status ? ` (${status})` : ''}.`, status);
  }
  return new LlmError('unknown', 'Unexpected error while contacting Claude.');
}

export function createAnthropicClient(apiKey: string, opts: { model: string; thinking: Thinking }): LlmClient {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
    timeout: REQUEST_TIMEOUT_MS,
  });

  return {
    async callStructured(call) {
      const params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming = {
        model: opts.model,
        max_tokens: call.maxTokens,
        system: [
          { type: 'text', text: call.system, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: call.context, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: call.user }],
        output_config: { effort: opts.thinking, format: { type: 'json_schema', schema: call.schema } },
      };
      if (USE_REFUSAL_FALLBACK) {
        params.betas = ['server-side-fallback-2026-07-01'];
        params.fallbacks = 'default';
      }

      let response: Anthropic.Beta.Messages.BetaMessage;
      try {
        response = await client.beta.messages.create(params, { signal: call.signal ?? undefined });
      } catch (err) {
        throw toLlmError(err);
      }

      if (response.stop_reason === 'refusal') {
        throw new LlmError('refused', 'Claude declined to answer this request.');
      }
      if (response.stop_reason === 'max_tokens') {
        throw new LlmError('invalid_answer', 'the answer was cut off before it was complete');
      }
      const text = response.content
        .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      return { json: parseJsonAnswer(text), stopReason: response.stop_reason };
    },

    async ping() {
      try {
        await client.messages.create({
          model: opts.model,
          max_tokens: 8,
          output_config: { effort: 'low' },
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        });
      } catch (err) {
        throw toLlmError(err);
      }
    },
  };
}
