import type { ProviderId } from '@/lib/llm/types';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** One line under the name in settings. */
  tagline: string;
  auth: 'key' | 'chatgpt';
  /** Host permissions this provider needs, requested when it is turned on. */
  origins: string[];
  /** Where to create an API key. */
  keyUrl?: string;
  keyPlaceholder?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    tagline: 'Claude models. The prompts were tuned on Claude Sonnet 5.5.',
    auth: 'key',
    origins: ['https://api.anthropic.com/*'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-…',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'GPT models with your OpenAI API key.',
    auth: 'key',
    origins: ['https://api.openai.com/*'],
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-…',
  },
  {
    id: 'google',
    name: 'Google Gemini',
    tagline: 'Gemini models with a Google AI Studio key.',
    auth: 'key',
    origins: ['https://generativelanguage.googleapis.com/*'],
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIza…',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Hundreds of models from many companies with one key.',
    auth: 'key',
    origins: ['https://openrouter.ai/*'],
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyPlaceholder: 'sk-or-…',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    tagline: 'Use your ChatGPT plan instead of an API key.',
    auth: 'chatgpt',
    origins: ['https://auth.openai.com/*', 'https://api.openai.com/*'],
  },
];

export function providerInfo(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id)!;
}

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);
export const isProviderId = (v: unknown): v is ProviderId => typeof v === 'string' && (PROVIDER_IDS as string[]).includes(v);
