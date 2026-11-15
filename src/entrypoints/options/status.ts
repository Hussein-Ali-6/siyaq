import { PROVIDERS, providerInfo } from '@/lib/llm/providers';
import type { ProviderId } from '@/lib/llm/types';
import type { ProviderSettings } from '@/lib/storage/settings';

export interface ProviderView {
  id: ProviderId;
  /** An API key is saved, or the reader is signed in to ChatGPT. */
  hasCredential: boolean;
  /** The optional host permission for this provider is granted. */
  permitted: boolean;
  settings: ProviderSettings;
  email?: string;
  planUsage?: boolean;
  /** Everything needed for lookups is in place. */
  ready: boolean;
}

export type ProviderViews = Record<ProviderId, ProviderView>;

/**
 * What a provider with a key or a sign-in still lacks before it can answer lookups. Permission comes
 * before the model, because the model list cannot be loaded without it.
 */
function missing(view: ProviderView): 'plan' | 'permission' | 'model' | null {
  if (view.id === 'chatgpt' && !view.planUsage) return 'plan';
  if (!view.permitted) return 'permission';
  if (!view.settings.model) return 'model';
  return null;
}

export interface RowStatus {
  text: string;
  tone: 'active' | 'ready' | 'attention' | 'off';
}

/** The state shown on a provider's row. `isActive` means it is the provider that answers lookups. */
export function rowStatus(view: ProviderView, isActive: boolean): RowStatus {
  if (view.ready) return isActive ? { text: 'In use', tone: 'active' } : { text: 'Connected', tone: 'ready' };
  if (!view.hasCredential) return { text: 'Not connected', tone: 'off' };
  const gap = missing(view);
  if (gap === 'plan') return { text: 'Plan usage off', tone: 'attention' };
  if (gap === 'model') return { text: 'Choose a model', tone: 'attention' };
  return { text: 'Needs permission', tone: 'attention' };
}

export type SetupState =
  /** Lookups work, with this provider. */
  | { kind: 'ready'; provider: ProviderId }
  /** Nothing is connected yet. */
  | { kind: 'welcome' }
  /** A key or a sign-in is saved, but lookups cannot work. */
  | { kind: 'problem'; provider: ProviderId; reason: string };

/** What the top of the settings page has to tell the reader. */
export function setupState(views: ProviderViews, active: ProviderId): SetupState {
  if (views[active].ready) return { kind: 'ready', provider: active };
  // Lookups switch to another ready provider when the one in use is not set up.
  const ready = PROVIDERS.find((p) => views[p.id].ready);
  if (ready) return { kind: 'ready', provider: ready.id };

  const started = views[active].hasCredential ? views[active] : PROVIDERS.map((p) => views[p.id]).find((v) => v.hasCredential);
  if (!started) return { kind: 'welcome' };
  const name = providerInfo(started.id).name;
  const gap = missing(started);
  const reason =
    gap === 'plan'
      ? 'ChatGPT is signed in, but it is not allowed to use your plan.'
      : gap === 'model'
        ? `No model is chosen for ${name}.`
        : `Siyaq does not have permission to reach ${name}.`;
  return { kind: 'problem', provider: started.id, reason };
}

/** A saved key as it is shown: its last four characters only, and nothing of a short key. */
export function maskKey(key: string): string {
  return key.length >= 8 ? `••••${key.slice(-4)}` : '••••';
}
