import { CHATGPT_RESOURCE } from '@/lib/auth/chatgpt-oauth';
import { LlmError, REQUEST_TIMEOUT_MS, parseJsonAnswer, type LlmClient, type StructuredCall, type StructuredResult, type Thinking } from '@/lib/llm/types';

/**
 * Calls the Responses API with a ChatGPT plan token. This route accepts only some fields
 * (https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations): it needs
 * store: false and stream: true, and rejects max_output_tokens, temperature and others, so the request
 * is built by hand instead of through the AI SDK.
 */
const RESPONSES_URL = `${CHATGPT_RESOURCE}/responses`;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface ChatGptClientOptions {
  /** Returns a fresh access token, refreshing it first when needed. */
  getAccessToken(): Promise<string>;
  model: string;
  thinking: Thinking;
  fetch?: FetchFn;
}

/** Yields the JSON payload of every `data:` line in a server-sent event stream. */
export async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const flush = function* (block: string) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;
    try {
      yield JSON.parse(data) as unknown;
    } catch {
      // Ignore keep-alive comments and malformed lines.
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      yield* flush(block);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) yield* flush(buffer);
}

interface ApiErrorInfo {
  code?: string;
  param?: string;
  message?: string;
}

function errorInfo(body: unknown): ApiErrorInfo {
  if (typeof body !== 'object' || body === null) return {};
  const b = body as Record<string, unknown>;
  const e = (typeof b.error === 'object' && b.error !== null ? b.error : b) as Record<string, unknown>;
  return {
    code: typeof e.code === 'string' ? e.code : undefined,
    param: typeof e.param === 'string' ? e.param : undefined,
    message: typeof e.message === 'string' ? e.message : typeof b.detail === 'string' ? b.detail : undefined,
  };
}

/** Maps the documented ChatGPT plan errors to messages a reader can act on. */
function toError(status: number, info: ApiErrorInfo): LlmError {
  switch (info.code) {
    case 'subscription_sharing_usage_limit_exceeded':
      return new LlmError('usage_limit', "You've reached the usage limit for Siyaq on your ChatGPT plan. Check Manage usage in ChatGPT settings.", status);
    case 'subscription_sharing_user_not_eligible':
      return new LlmError('not_eligible', "This ChatGPT account can't use its plan in other apps.", status);
    case 'subscription_sharing_usage_unavailable':
    case 'subscription_sharing_user_unavailable':
      return new LlmError('overloaded', 'ChatGPT plan usage is temporarily unavailable. Try again shortly.', status);
    case 'subscription_sharing_invalid_user':
      return new LlmError('signed_out', 'Your ChatGPT sign-in is no longer valid. Sign in again in Siyaq settings.', status);
  }
  if (status === 401) return new LlmError('signed_out', 'Your ChatGPT sign-in has expired. Sign in again in Siyaq settings.', status);
  if (status === 403) return new LlmError('not_eligible', `ChatGPT refused the request${info.message ? `: ${info.message}` : '.'}`, status);
  if (status === 429) return new LlmError('rate_limited', 'Too many requests to ChatGPT. Try again in a moment.', status);
  if (status >= 500) return new LlmError('overloaded', 'ChatGPT is busy right now. Try again shortly.', status);
  return new LlmError('bad_request', `ChatGPT rejected the request${info.message ? `: ${info.message}` : '.'}`, status);
}

class Unsupported extends Error {
  constructor(public readonly param: string) {
    super(`unsupported: ${param}`);
  }
}

export function createChatGptClient(opts: ChatGptClientOptions): LlmClient {
  const fetchFn: FetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
  // Features this route turned out not to accept; remembered for the life of the client.
  let structuredOutput = true;
  let reasoning = true;

  async function stream(body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const token = await opts.getAccessToken();
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchFn(RESPONSES_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(body),
        redirect: 'error',
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new LlmError('timeout', 'ChatGPT took too long to answer.');
      }
      throw new LlmError('network', 'Could not reach ChatGPT. Check your connection.');
    }
    if (!res.ok) {
      const info = errorInfo(await res.json().catch(() => ({})));
      if (res.status === 400 && info.code === 'subscription_sharing_unsupported_capability' && info.param) throw new Unsupported(info.param);
      throw toError(res.status, info);
    }
    if (!res.body) throw new LlmError('network', 'ChatGPT returned an empty response.');
    let text = '';
    try {
      for await (const event of readSseEvents(res.body)) {
        const e = event as { type?: string; delta?: unknown; response?: unknown };
        if (e.type === 'response.output_text.delta' && typeof e.delta === 'string') text += e.delta;
        else if (e.type === 'response.failed' || e.type === 'error') {
          throw toError(429, errorInfo(e.type === 'response.failed' ? e.response : e));
        } else if (e.type === 'response.incomplete') throw new LlmError('invalid_answer', 'the answer was cut off before it was complete');
        else if (e.type === 'response.completed') return text;
      }
    } catch (err) {
      if (err instanceof LlmError) throw err;
      throw new LlmError('network', 'The connection to ChatGPT dropped. Try again.');
    }
    throw new LlmError('network', 'The ChatGPT response ended before it was complete.');
  }

  async function send(call: StructuredCall): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const body: Record<string, unknown> = {
        model: opts.model,
        instructions: `${call.system}\n\n${call.context}`,
        input: [{ role: 'user', content: structuredOutput ? call.user : `${call.user}\n\nAnswer with the JSON object only.` }],
        store: false,
        stream: true,
      };
      if (structuredOutput) body.text = { format: { type: 'json_schema', name: 'siyaq_answer', schema: call.schema, strict: true } };
      if (reasoning) body.reasoning = { effort: opts.thinking };
      try {
        return await stream(body, call.signal);
      } catch (err) {
        if (!(err instanceof Unsupported)) throw err;
        if (err.param.startsWith('text') && structuredOutput) structuredOutput = false;
        else if (err.param.startsWith('reasoning') && reasoning) reasoning = false;
        else throw new LlmError('bad_request', `ChatGPT does not support "${err.param}" for this model.`, 400);
      }
    }
    throw new LlmError('bad_request', 'ChatGPT rejected the request.', 400);
  }

  return {
    async callStructured(call): Promise<StructuredResult> {
      const text = await send(call);
      return { json: parseJsonAnswer(text), stopReason: 'end_turn' };
    },
    async ping() {
      await stream({ model: opts.model, instructions: 'Reply with the single word: ok', input: [{ role: 'user', content: 'ok?' }], store: false, stream: true });
    },
  };
}
