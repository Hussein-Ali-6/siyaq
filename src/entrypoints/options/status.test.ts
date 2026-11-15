import { describe, expect, it } from 'vitest';
import { PROVIDERS } from '@/lib/llm/providers';
import type { ProviderId } from '@/lib/llm/types';
import { maskKey, rowStatus, setupState, type ProviderView } from './status';

function view(id: ProviderId, over: Partial<ProviderView> = {}): ProviderView {
  return { id, hasCredential: false, permitted: false, settings: { model: '', thinking: 'medium' }, ready: false, ...over };
}
const connected = (id: ProviderId, over: Partial<ProviderView> = {}) =>
  view(id, { hasCredential: true, permitted: true, settings: { model: 'some-model', thinking: 'medium' }, ready: true, ...over });

function all(over: Partial<Record<ProviderId, ProviderView>> = {}): Record<ProviderId, ProviderView> {
  return Object.fromEntries(PROVIDERS.map((p) => [p.id, over[p.id] ?? view(p.id)])) as Record<ProviderId, ProviderView>;
}

describe('rowStatus', () => {
  it('says "In use" only for the ready provider that answers lookups', () => {
    expect(rowStatus(connected('openai'), true)).toEqual({ text: 'In use', tone: 'active' });
    expect(rowStatus(connected('openai'), false)).toEqual({ text: 'Connected', tone: 'ready' });
  });

  it('says "Not connected" when nothing is saved, also for the provider in use', () => {
    expect(rowStatus(view('anthropic'), true)).toEqual({ text: 'Not connected', tone: 'off' });
    expect(rowStatus(view('google'), false)).toEqual({ text: 'Not connected', tone: 'off' });
  });

  it('names what is missing when a key is saved but lookups cannot work', () => {
    const noPermission = view('openai', { hasCredential: true, settings: { model: 'gpt', thinking: 'medium' } });
    const noModel = view('openai', { hasCredential: true, permitted: true });
    expect(rowStatus(noPermission, true)).toEqual({ text: 'Needs permission', tone: 'attention' });
    expect(rowStatus(noModel, false)).toEqual({ text: 'Choose a model', tone: 'attention' });
  });

  it('asks for permission before a model, because the model list needs the permission', () => {
    expect(rowStatus(view('google', { hasCredential: true }), false).text).toBe('Needs permission');
  });

  it('says "Plan usage off" for a ChatGPT sign-in that may not use the plan', () => {
    const signedIn = view('chatgpt', { hasCredential: true, permitted: true, planUsage: false, settings: { model: 'gpt', thinking: 'medium' } });
    expect(rowStatus(signedIn, false)).toEqual({ text: 'Plan usage off', tone: 'attention' });
  });
});

describe('setupState', () => {
  it('is ready when the provider in use is ready', () => {
    expect(setupState(all({ openai: connected('openai') }), 'openai')).toEqual({ kind: 'ready', provider: 'openai' });
  });

  it('is ready with another provider when the one in use is not set up, because lookups switch to it', () => {
    expect(setupState(all({ google: connected('google') }), 'anthropic')).toEqual({ kind: 'ready', provider: 'google' });
  });

  it('welcomes a reader who has connected nothing', () => {
    expect(setupState(all(), 'anthropic')).toEqual({ kind: 'welcome' });
  });

  it('reports the provider in use when its key is saved but something is missing', () => {
    const views = all({ anthropic: view('anthropic', { hasCredential: true, settings: { model: 'claude', thinking: 'medium' } }) });
    expect(setupState(views, 'anthropic')).toEqual({ kind: 'problem', provider: 'anthropic', reason: 'Siyaq does not have permission to reach Anthropic.' });
  });

  it('reports another provider with a saved key when the one in use has none', () => {
    const views = all({ openai: view('openai', { hasCredential: true, permitted: true }) });
    expect(setupState(views, 'anthropic')).toEqual({ kind: 'problem', provider: 'openai', reason: 'No model is chosen for OpenAI.' });
  });

  it('explains a ChatGPT sign-in without plan usage', () => {
    const views = all({ chatgpt: view('chatgpt', { hasCredential: true, permitted: true, planUsage: false }) });
    expect(setupState(views, 'chatgpt')).toEqual({ kind: 'problem', provider: 'chatgpt', reason: 'ChatGPT is signed in, but it is not allowed to use your plan.' });
  });
});

describe('maskKey', () => {
  it('shows only the last four characters', () => {
    expect(maskKey('sk-ant-api03-abcdefgh1234')).toBe('••••1234');
  });

  it('shows nothing of a short key', () => {
    expect(maskKey('abc1234')).toBe('••••');
    expect(maskKey('')).toBe('••••');
  });
});
