import { defineExtensionMessaging } from '@webext-core/messaging';
import type { ArticleText } from '@/lib/dom/article';
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
  getStatus(): { hasKey: boolean };
  testApiKey(): KeyTestResult;
  clearCaches(): { removed: number };
  openOptions(): void;
  extractArticle(): ArticleText | null;
}

/** The library's default logger prints message payloads, which contain page text. Silence it. */
const silentLogger = { debug() {}, log() {}, warn() {}, error() {} };

export const { sendMessage, onMessage, removeAllListeners } = defineExtensionMessaging<ProtocolMap>({
  logger: silentLogger,
});
