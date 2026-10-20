import type { ErrorCode } from '@/lib/types';
import type { JsonSchema } from '@/lib/llm/schemas';

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'chatgpt';
export type Thinking = 'low' | 'medium' | 'high';

export const REQUEST_TIMEOUT_MS = 30_000;

export class LlmError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }

  /** Transient failures worth one more attempt. */
  get retryable(): boolean {
    return this.code === 'rate_limited' || this.code === 'overloaded' || this.code === 'timeout' || this.code === 'network';
  }
}

export interface StructuredCall {
  /** Static instructions; the prefix providers cache. */
  system: string;
  /** Per-page context (title, site, summary); cached as a second breakpoint where the provider allows. */
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

/** One configured provider and model. Every provider adapter implements this. */
export interface LlmClient {
  callStructured(call: StructuredCall): Promise<StructuredResult>;
  /** A minimal request used to check that the credentials work. Throws an LlmError otherwise. */
  ping(): Promise<void>;
}

/** Parses a model's text answer as JSON, tolerating a Markdown code fence around it. */
export function parseJsonAnswer(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new LlmError('invalid_answer', 'the answer was not valid JSON');
  }
}
