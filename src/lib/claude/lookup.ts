import { ClaudeError, MODEL, type ClaudeClient } from '@/lib/claude/client';
import {
  DICTIONARY_SYSTEM,
  PROMPT_VERSION,
  TRANSLATION_SYSTEM,
  dictionaryUserMessage,
  pageContextBlock,
  translationUserMessage,
} from '@/lib/claude/prompts';
import { DICTIONARY_SCHEMA, TRANSLATION_SCHEMA } from '@/lib/claude/schemas';
import { validateDictionary, validateTranslation } from '@/lib/claude/validate';
import { log } from '@/lib/log';
import { sha256Hex } from '@/lib/storage/hash';
import { normalizeUrl } from '@/lib/storage/url';
import { buildNumberedPassage } from '@/lib/text/tokens';
import { MAX_SELECTION_WORDS, countWords } from '@/lib/text/words';
import type { Card, LookupRequest, LookupResponse, Summary } from '@/lib/types';

export interface CardCache {
  get(key: string): Promise<Card | null>;
  set(key: string, card: Card): Promise<void>;
}

export interface LookupDeps {
  client: ClaudeClient;
  cache: CardCache;
  getSummary(url: string): Promise<Summary | null>;
  signal?: AbortSignal;
  /** Pause before retrying a transient API error. Tests pass 0. */
  retryDelayMs?: number;
}

const DEFAULT_RETRY_DELAY_MS = 700;

/** Cache key: prompt version + model + kind + page + paragraph + selection + which occurrence. */
export async function cacheKeyFor(req: LookupRequest): Promise<string> {
  const material = [
    `v${PROMPT_VERSION}`,
    MODEL,
    req.kind,
    normalizeUrl(req.page.url),
    req.paragraph,
    req.selection,
    buildNumberedPassage(req.passage),
    req.selectedIndices.join(','),
  ].join('\u0001');
  return sha256Hex(material);
}

function maxTokensFor(req: LookupRequest): number {
  if (req.kind === 'word') return 1500;
  return Math.min(6000, 800 + countWords(req.selection) * 6);
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function performLookup(req: LookupRequest, deps: LookupDeps): Promise<LookupResponse> {
  if (countWords(req.selection) > MAX_SELECTION_WORDS) {
    return {
      ok: false,
      error: { code: 'too_long', message: `Select up to ${MAX_SELECTION_WORDS} words at a time.` },
    };
  }

  const key = await cacheKeyFor(req);
  const cached = await deps.cache.get(key);
  if (cached) {
    log.info('lookup_cached', { kind: req.kind });
    return { ok: true, card: cached, cached: true, id: key };
  }

  const summary = await deps.getSummary(req.page.url);
  const context = pageContextBlock(req.page, summary);
  const isWord = req.kind === 'word';
  const system = isWord ? DICTIONARY_SYSTEM : TRANSLATION_SYSTEM;
  const schema = isWord ? DICTIONARY_SCHEMA : TRANSLATION_SCHEMA;
  const maxTokens = maxTokensFor(req);
  const retryDelay = deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let hint: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = isWord ? dictionaryUserMessage(req, hint) : translationUserMessage(req, hint);
    const started = Date.now();
    let json: unknown;
    try {
      ({ json } = await deps.client.callStructured({ system, context, user, schema, maxTokens, signal: deps.signal }));
    } catch (err) {
      const e = err instanceof ClaudeError ? err : new ClaudeError('unknown', 'Unexpected error while contacting Claude.');
      log.warn('lookup_api_error', { code: e.code, status: e.status ?? 0, attempt, ms: Date.now() - started });
      if (attempt === 0 && e.code === 'invalid_answer') {
        hint = e.message;
        continue;
      }
      if (attempt === 0 && e.retryable) {
        if (retryDelay > 0) await delay(retryDelay);
        continue;
      }
      return { ok: false, error: { code: e.code, message: e.message, status: e.status } };
    }

    const validated = isWord
      ? validateDictionary(json, req.passage, req.selectedIndices)
      : validateTranslation(json, req.passage);
    if (validated.ok) {
      log.info('lookup_ok', { kind: req.kind, attempt, ms: Date.now() - started });
      await deps.cache.set(key, validated.card);
      return { ok: true, card: validated.card, cached: false, id: key };
    }
    log.warn('lookup_answer_invalid', { kind: req.kind, attempt });
    hint = validated.reason;
  }

  return {
    ok: false,
    error: { code: 'invalid_answer', message: 'Claude gave an unusable answer twice. Try again.' },
  };
}
