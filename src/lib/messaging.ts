import { defineExtensionMessaging } from '@webext-core/messaging';
import type { ArticleText } from '@/lib/dom/article';
import type { ModelOption } from '@/lib/llm/models';
import type { ProviderId } from '@/lib/llm/types';
import type { LookupRequest, LookupResponse, Prefs, SavedItem, Summary, SummaryResponse } from '@/lib/types';

export interface SummarizeRequest {
  url: string;
  title: string;
  siteName: string;
  text: string;
}

export interface KeyTestResult {
  ok: boolean;
  message: string;
}

export interface ProviderStatus {
  provider: ProviderId;
  providerName: string;
  model: string;
  /** True when the active provider has credentials, a model and permission. */
  ready: boolean;
  problem?: string;
}

export type ModelListResult = { ok: true; models: ModelOption[]; recommended: string | null } | { ok: false; message: string };

/**
 * Every message in the extension. Content script, popup and options page send; the service
 * worker answers, except `extractArticle`, which the popup sends to a tab's content script.
 */
export interface ProtocolMap {
  lookup(req: LookupRequest): LookupResponse;
  getSummary(url: string): Summary | null;
  summarize(req: SummarizeRequest): SummaryResponse;
  saveItem(item: Omit<SavedItem, 'savedAt'>): SavedItem;
  unsaveItem(id: string): void;
  isSaved(id: string): boolean;
  getPrefs(): Prefs;
  getStatus(): ProviderStatus;
  testProvider(provider: ProviderId): KeyTestResult;
  listModels(provider: ProviderId): ModelListResult;
  clearCaches(): { removed: number };
  openOptions(): void;
  extractArticle(): ArticleText | null;
}

/** The library's default logger prints message payloads, which contain page text. Silence it. */
const silentLogger = { debug() {}, log() {}, warn() {}, error() {} };

export const { sendMessage, onMessage, removeAllListeners } = defineExtensionMessaging<ProtocolMap>({
  logger: silentLogger,
});
