import { LlmError, type LlmClient } from '@/lib/llm/types';
import { pageContextBlock, summarySystem, summaryUserMessage } from '@/lib/llm/prompts';
import { summarySchema } from '@/lib/llm/schemas';
import { validateSummary } from '@/lib/llm/validate';
import { log } from '@/lib/log';
import { normalizeUrl } from '@/lib/storage/url';
import type { Summary, SummaryResponse } from '@/lib/types';

export interface SummaryCache {
  get(url: string): Promise<Summary | null>;
  set(url: string, summary: Summary): Promise<void>;
}

export interface SummaryDeps {
  client: LlmClient;
  cache: SummaryCache;
  /** Translation language id; "none" for an English-only summary. */
  language: string;
  retryDelayMs?: number;
}

export interface SummaryInput {
  url: string;
  title: string;
  siteName: string;
  text: string;
}

const inflight = new Map<string, Promise<SummaryResponse>>();
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function summarize(input: SummaryInput, deps: SummaryDeps): Promise<SummaryResponse> {
  const context = pageContextBlock({ url: input.url, title: input.title, siteName: input.siteName }, null);
  const retryDelay = deps.retryDelayMs ?? 700;
  let hint = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = summaryUserMessage(input) + (hint ? `\n\nYour previous answer was rejected: ${hint}.` : '');
    let json: unknown;
    try {
      ({ json } = await deps.client.callStructured({
        system: summarySystem(deps.language),
        context,
        user,
        schema: summarySchema(deps.language),
        maxTokens: 5000,
      }));
    } catch (err) {
      const e = err instanceof LlmError ? err : new LlmError('unknown', 'Unexpected error while contacting the AI provider.');
      log.warn('summary_api_error', { code: e.code, status: e.status ?? 0, attempt });
      if (attempt === 0 && (e.retryable || e.code === 'invalid_answer')) {
        if (e.retryable && retryDelay > 0) await delay(retryDelay);
        continue;
      }
      return { ok: false, error: { code: e.code, message: e.message, status: e.status } };
    }
    const validated = validateSummary(json, deps.language);
    if (validated.ok) {
      await deps.cache.set(input.url, validated.card);
      log.info('summary_ok', { attempt });
      return { ok: true, summary: validated.card, cached: false };
    }
    log.warn('summary_answer_invalid', { attempt });
    hint = validated.reason;
  }
  return { ok: false, error: { code: 'invalid_answer', message: 'The model gave an unusable summary twice.' } };
}

/** Summarises a page once: cached per URL, and concurrent callers share one request. */
export async function performSummary(input: SummaryInput, deps: SummaryDeps): Promise<SummaryResponse> {
  if (!input.text.trim()) {
    return { ok: false, error: { code: 'bad_request', message: 'This page has no readable text to summarise.' } };
  }
  const cached = await deps.cache.get(input.url);
  if (cached) return { ok: true, summary: cached, cached: true };
  const key = normalizeUrl(input.url);
  const existing = inflight.get(key);
  if (existing) return existing;
  const run = summarize(input, deps).finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}
