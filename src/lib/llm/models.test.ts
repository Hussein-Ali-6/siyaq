import { describe, expect, it } from 'vitest';
import { normalizeModels, recommendModel } from '@/lib/llm/models';

describe('normalizeModels', () => {
  it('reads Anthropic models with their display names, in API order', () => {
    const raw = { data: [
      { id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' },
      { id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' },
    ] };
    expect(normalizeModels('anthropic', raw)).toEqual([
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
    ]);
  });

  it('keeps only OpenAI text models and sorts them', () => {
    const ids = ['gpt-6.1', 'text-embedding-3-large', 'tts-1', 'whisper-1', 'dall-e-3', 'gpt-image-2', 'gpt-6.1-realtime',
      'gpt-6.1-audio-preview', 'omni-moderation-latest', 'o5-mini', 'gpt-6.1-transcribe', 'gpt-6.1-mini', 'gpt-6.1-search-preview'];
    const out = normalizeModels('openai', { data: ids.map((id) => ({ id })) });
    expect(out.map((m) => m.id)).toEqual(['gpt-6.1', 'gpt-6.1-mini', 'o5-mini']);
  });

  it('keeps only the ChatGPT models the account can list', () => {
    const raw = { models: [
      { slug: 'gpt-6.1-sol', display_name: 'GPT-6.1 Sol', visibility: 'list' },
      { slug: 'internal', display_name: 'Internal', visibility: 'hidden' },
    ] };
    expect(normalizeModels('chatgpt', raw)).toEqual([{ id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' }]);
  });

  it('keeps Gemini models that generate text, without the models/ prefix', () => {
    const raw = { models: [
      { name: 'models/gemini-3-flash', displayName: 'Gemini 3 Flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-3-flash-image', displayName: 'Image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3-flash-tts', displayName: 'TTS', supportedGenerationMethods: ['generateContent'] },
    ] };
    expect(normalizeModels('google', raw)).toEqual([{ id: 'gemini-3-flash', label: 'Gemini 3 Flash' }]);
  });

  it('keeps OpenRouter models that support structured output, sorted by id', () => {
    const raw = { data: [
      { id: 'openai/gpt-6.1-mini', name: 'OpenAI: GPT-6.1 Mini', supported_parameters: ['response_format'] },
      { id: 'anthropic/claude-sonnet-5.5', name: 'Anthropic: Claude Sonnet 5.5', supported_parameters: ['structured_outputs', 'reasoning'] },
      { id: 'tiny/model', name: 'Tiny', supported_parameters: ['temperature'] },
    ] };
    expect(normalizeModels('openrouter', raw).map((m) => m.id)).toEqual(['anthropic/claude-sonnet-5.5', 'openai/gpt-6.1-mini']);
  });

  it('returns an empty list for an unexpected response', () => {
    expect(normalizeModels('openai', { nope: true })).toEqual([]);
    expect(normalizeModels('google', null)).toEqual([]);
  });
});

const opts = (...ids: string[]) => ids.map((id) => ({ id, label: id }));

describe('recommendModel', () => {
  it('prefers Claude Sonnet 5.5, the model the prompts were tuned on', () => {
    expect(recommendModel('anthropic', opts('claude-opus-5-5', 'claude-sonnet-5-5'))).toBe('claude-sonnet-5-5');
    expect(recommendModel('anthropic', opts('claude-opus-5-5', 'claude-sonnet-6'))).toBe('claude-sonnet-6');
  });

  it('prefers the newest mini GPT model, then the newest GPT model', () => {
    expect(recommendModel('openai', opts('gpt-5-mini', 'gpt-6.1', 'gpt-6.1-mini', 'gpt-6-mini'))).toBe('gpt-6.1-mini');
    expect(recommendModel('openai', opts('gpt-5', 'gpt-6.1', 'o5-mini'))).toBe('gpt-6.1');
    expect(recommendModel('chatgpt', opts('gpt-6.1-sol'))).toBe('gpt-6.1-sol');
  });

  it('prefers the newest stable Gemini Flash model', () => {
    expect(recommendModel('google', opts('gemini-2.5-flash', 'gemini-3-flash', 'gemini-3.5-flash-preview', 'gemini-3-pro'))).toBe('gemini-3-flash');
    expect(recommendModel('google', opts('gemini-3.5-flash-preview', 'gemini-3-pro'))).toBe('gemini-3.5-flash-preview');
  });

  it('prefers Claude Sonnet on OpenRouter', () => {
    expect(recommendModel('openrouter', opts('anthropic/claude-sonnet-4.5', 'anthropic/claude-sonnet-5.5', 'openai/gpt-6.1-mini'))).toBe('anthropic/claude-sonnet-5.5');
    expect(recommendModel('openrouter', opts('meta/llama-5', 'openai/gpt-6.1-mini'))).toBe('openai/gpt-6.1-mini');
  });

  it('falls back to the first model, or null when there are none', () => {
    expect(recommendModel('openai', opts('o5-mini'))).toBe('o5-mini');
    expect(recommendModel('openai', [])).toBeNull();
  });
});
