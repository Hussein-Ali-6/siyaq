import type { ProviderId } from '@/lib/llm/types';

export interface ModelOption {
  id: string;
  label: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const arrayAt = (raw: unknown, key: string): unknown[] => (isObject(raw) && Array.isArray(raw[key]) ? (raw[key] as unknown[]) : []);
const byId = (a: ModelOption, b: ModelOption) => a.id.localeCompare(b.id);

/** OpenAI ids that are not text-chat models: embeddings, speech, images, moderation, realtime, search. */
const OPENAI_NON_TEXT = /(embedding|tts|whisper|dall-e|image|realtime|audio|moderation|transcribe|search|computer-use|davinci|babbage|codex)/;
/** Gemini ids that do not answer with text. */
const GOOGLE_NON_TEXT = /(embed|image|imagen|tts|audio|live|aqa|veo|lyria)/;

/** Turns a provider's model-list response into options for the picker, keeping only usable text models. */
export function normalizeModels(provider: ProviderId, raw: unknown): ModelOption[] {
  switch (provider) {
    case 'anthropic':
      return arrayAt(raw, 'data').flatMap((m) => {
        const id = isObject(m) ? str(m.id) : null;
        return id ? [{ id, label: (isObject(m) && str(m.display_name)) || id }] : [];
      });
    case 'openai':
      return arrayAt(raw, 'data')
        .flatMap((m) => {
          const id = isObject(m) ? str(m.id) : null;
          return id && /^(gpt-|o\d|chatgpt-)/.test(id) && !OPENAI_NON_TEXT.test(id) ? [{ id, label: id }] : [];
        })
        .sort(byId);
    case 'chatgpt':
      return arrayAt(raw, 'models').flatMap((m) => {
        if (!isObject(m) || m.visibility !== 'list') return [];
        const id = str(m.slug);
        return id ? [{ id, label: str(m.display_name) || id }] : [];
      });
    case 'google':
      return arrayAt(raw, 'models').flatMap((m) => {
        if (!isObject(m)) return [];
        const name = str(m.name);
        const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
        if (!name || !methods.includes('generateContent')) return [];
        const id = name.replace(/^models\//, '');
        return /^gemini-/.test(id) && !GOOGLE_NON_TEXT.test(id) ? [{ id, label: str(m.displayName) || id }] : [];
      });
    case 'openrouter':
      return arrayAt(raw, 'data')
        .flatMap((m) => {
          if (!isObject(m)) return [];
          const id = str(m.id);
          const params = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
          const structured = params.includes('structured_outputs') || params.includes('response_format');
          return id && structured ? [{ id, label: str(m.name) || id }] : [];
        })
        .sort(byId);
  }
}

/** Numeric version of a model id such as "gpt-6.1-mini" or "gemini-3.5-flash", for picking the newest. */
function version(match: RegExpMatchArray | null): number {
  if (!match) return -1;
  return Number(match[1]) * 1000 + Number(match[2] ?? 0);
}

function newest(models: ModelOption[], pattern: RegExp): string | null {
  let best: { id: string; v: number } | null = null;
  for (const m of models) {
    const v = version(m.id.match(pattern));
    if (v >= 0 && (!best || v > best.v)) best = { id: m.id, v };
  }
  return best?.id ?? null;
}

/** A sensible default from the live list: the tuned Claude Sonnet, the newest small GPT, the newest Gemini Flash. */
export function recommendModel(provider: ProviderId, models: ModelOption[]): string | null {
  if (models.length === 0) return null;
  const ids = models.map((m) => m.id);
  switch (provider) {
    case 'anthropic':
      return ids.includes('claude-sonnet-5-5') ? 'claude-sonnet-5-5' : (ids.find((id) => id.includes('sonnet')) ?? ids[0]!);
    case 'openai':
    case 'chatgpt':
      return newest(models, /^gpt-(\d+)(?:\.(\d+))?-mini$/) ?? newest(models, /^gpt-(\d+)(?:\.(\d+))?$/) ?? ids[0]!;
    case 'google':
      return newest(models, /^gemini-(\d+)(?:\.(\d+))?-flash$/) ?? newest(models, /^gemini-(\d+)(?:\.(\d+))?-flash(?:-[a-z0-9-]+)?$/) ?? ids[0]!;
    case 'openrouter':
      return newest(models, /^anthropic\/claude-sonnet-(\d+)(?:\.(\d+))?$/) ?? newest(models, /^openai\/gpt-(\d+)(?:\.(\d+))?-mini$/) ?? ids[0]!;
  }
}
