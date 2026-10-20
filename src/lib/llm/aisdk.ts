import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, Output, RetryError, generateText, jsonSchema, type JSONValue, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LlmError, REQUEST_TIMEOUT_MS, type LlmClient, type StructuredCall, type Thinking } from '@/lib/llm/types';

export type AiSdkProvider = 'openai' | 'google' | 'openrouter';

const NAMES: Record<AiSdkProvider, string> = { openai: 'OpenAI', google: 'Gemini', openrouter: 'OpenRouter' };

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface AiSdkClientOptions {
  apiKey: string;
  model: string;
  thinking: Thinking;
  fetch?: FetchFn;
}

/** The thinking level in each provider's own terms. */
export function aiSdkProviderOptions(provider: AiSdkProvider, thinking: Thinking): Record<string, Record<string, JSONValue>> {
  switch (provider) {
    case 'openai':
      return { openai: { reasoningEffort: thinking } };
    case 'google':
      return { google: { thinkingConfig: { thinkingLevel: thinking } } };
    case 'openrouter':
      return { openrouter: { reasoning: { effort: thinking } } };
  }
}

function languageModel(provider: AiSdkProvider, o: AiSdkClientOptions): LanguageModel {
  const common = { apiKey: o.apiKey, ...(o.fetch ? { fetch: o.fetch as typeof fetch } : {}) };
  switch (provider) {
    case 'openai':
      return createOpenAI(common).responses(o.model);
    case 'google':
      return createGoogleGenerativeAI(common)(o.model);
    case 'openrouter':
      return createOpenRouter({ ...common, appName: 'Siyaq', appUrl: 'https://github.com/siyaq' } as Parameters<typeof createOpenRouter>[0])(o.model);
  }
}

/** True when a 400 says the model does not take the thinking or reasoning option. */
function rejectsThinking(err: APICallError): boolean {
  if (err.statusCode !== 400) return false;
  const text = `${err.message} ${err.responseBody ?? ''}`.toLowerCase();
  return /reasoning|thinking/.test(text) && /(unsupported|not supported|unknown|invalid|not allowed)/.test(text);
}

function toLlmError(provider: AiSdkProvider, err: unknown): LlmError {
  const name = NAMES[provider];
  if (err instanceof LlmError) return err;
  if (RetryError.isInstance(err)) return toLlmError(provider, err.lastError);
  if (NoObjectGeneratedError.isInstance(err) || NoOutputGeneratedError.isInstance(err)) {
    return new LlmError('invalid_answer', 'the answer was not valid JSON matching the schema');
  }
  if (APICallError.isInstance(err)) {
    const status = err.statusCode;
    if (status === 401 || status === 403) return new LlmError('bad_key', `${name} rejected the API key.`, status);
    if (status === 429) return new LlmError('rate_limited', `${name} rate limit reached. Try again in a moment.`, status);
    if (status !== undefined && status >= 500) return new LlmError('overloaded', `${name} is busy right now. Try again shortly.`, status);
    if (status === 400 || status === 404 || status === 422) return new LlmError('bad_request', `${name} rejected the request: ${err.message}`, status);
    return new LlmError('network', `Could not reach ${name}. Check your connection.`);
  }
  if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return new LlmError('timeout', `${name} took too long to answer.`);
  }
  if (err instanceof TypeError) return new LlmError('network', `Could not reach ${name}. Check your connection.`);
  return new LlmError('unknown', `Unexpected error from ${name}.`);
}

/** OpenAI, Gemini and OpenRouter through the AI SDK. */
export function createAiSdkClient(provider: AiSdkProvider, o: AiSdkClientOptions): LlmClient {
  const model = languageModel(provider, o);
  let thinkingAccepted = true;

  async function run(call: StructuredCall): Promise<unknown> {
    const result = await generateText({
      model,
      // One system string: the static prompt first, so providers that cache by prefix can reuse it.
      system: `${call.system}\n\n${call.context}`,
      prompt: call.user,
      // No validate function: the schema only shapes the answer; validate.ts checks it strictly.
      output: Output.object({ schema: jsonSchema(call.schema as Parameters<typeof jsonSchema>[0]) }),
      maxOutputTokens: call.maxTokens,
      maxRetries: 0,
      timeout: REQUEST_TIMEOUT_MS,
      ...(call.signal ? { abortSignal: call.signal } : {}),
      ...(thinkingAccepted ? { providerOptions: aiSdkProviderOptions(provider, o.thinking) } : {}),
    });
    return result.output;
  }

  return {
    async callStructured(call) {
      try {
        return { json: await run(call), stopReason: 'end_turn' };
      } catch (err) {
        if (thinkingAccepted && APICallError.isInstance(err) && rejectsThinking(err)) {
          thinkingAccepted = false;
          try {
            return { json: await run(call), stopReason: 'end_turn' };
          } catch (retryErr) {
            throw toLlmError(provider, retryErr);
          }
        }
        throw toLlmError(provider, err);
      }
    },
    async ping() {
      try {
        await generateText({ model, prompt: 'Reply with the single word: ok', maxOutputTokens: 64, maxRetries: 0, timeout: REQUEST_TIMEOUT_MS });
      } catch (err) {
        throw toLlmError(provider, err);
      }
    },
  };
}
