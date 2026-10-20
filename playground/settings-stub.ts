/**
 * An in-memory stand-in for the extension APIs, so the real settings page can be viewed in the
 * playground. Scenario from the URL hash: #fresh (nothing set up), #chatgpt (signed in and active),
 * #chatgpt-only (signed in, no Anthropic key, nothing chosen), default
 * (Anthropic key saved and active).
 */
type Listener = (...args: unknown[]) => void;
const events = () => {
  const ls = new Set<Listener>();
  return { addListener: (l: Listener) => ls.add(l), removeListener: (l: Listener) => ls.delete(l), fire: (...a: unknown[]) => ls.forEach((l) => l(...a)) };
};

const scenario = location.hash.slice(1);
const store: Record<string, unknown> = {};
if (scenario !== 'fresh' && scenario !== 'chatgpt-only') {
  store.apiKey = 'sk-ant-playground';
}
if (scenario === 'chatgpt' || scenario === 'chatgpt-only') {
  if (scenario === 'chatgpt') store.activeProvider = 'chatgpt';
  store.chatgpt = { clientId: 'client_x', hostId: 'urn:uuid:x', port: 51234, accessToken: 'at', refreshToken: 'rt', expiresAt: Date.now() + 3_600_000, scopes: ['openid', 'chatgpt.tokens.use.direct'], email: 'reader@example.com' };
  store.providerSettings = { chatgpt: { model: 'gpt-6.1-sol', thinking: 'medium' } };
}
store['cache:a'] = { v: {}, at: 1 };
store['summary:b'] = { v: {}, at: 1 };

const granted = new Set<string>(['https://api.anthropic.com/*', ...(scenario.startsWith('chatgpt') ? ['https://auth.openai.com/*', 'https://api.openai.com/*'] : [])]);
const onChanged = events();
const onAdded = events();

const models: Record<string, Array<{ id: string; label: string }>> = {
  anthropic: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
  ],
  openai: ['gpt-6.1', 'gpt-6.1-mini', 'gpt-6-mini', 'o5-mini'].map((id) => ({ id, label: id })),
  google: [
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
    { id: 'gemini-3-pro', label: 'Gemini 3 Pro' },
  ],
  openrouter: Array.from({ length: 40 }, (_, i) => ({ id: `vendor${i % 7}/model-${i}`, label: `Vendor ${i % 7}: Model ${i}` })).concat([{ id: 'anthropic/claude-sonnet-5.5', label: 'Anthropic: Claude Sonnet 5.5' }]),
  chatgpt: [{ id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' }],
};
const recommended: Record<string, string> = { anthropic: 'claude-sonnet-5-5', openai: 'gpt-6.1-mini', google: 'gemini-3-flash', openrouter: 'anthropic/claude-sonnet-5.5', chatgpt: 'gpt-6.1-sol' };

function handle(type: string, data: unknown): unknown {
  switch (type) {
    case 'listModels':
      return { ok: true, models: models[data as string] ?? [], recommended: recommended[data as string] ?? null };
    case 'testProvider':
      return { ok: true, message: 'Test passed in the playground.' };
    case 'clearCaches':
      return { removed: 2 };
    case 'getStatus':
      return { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-sonnet-5-5', ready: true };
    default:
      return null;
  }
}

function pick(keys: unknown): Record<string, unknown> {
  if (keys === null || keys === undefined) return { ...store };
  const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys as object);
  return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
}

(globalThis as Record<string, unknown>).chrome = {
  runtime: {
    id: 'playground',
    getURL: (p: string) => p,
    openOptionsPage: async () => undefined,
    onMessage: events(),
    sendMessage: (msg: { type: string; data: unknown }, cb?: (r: unknown) => void) => {
      const response = { res: handle(msg.type, msg.data) };
      setTimeout(() => cb?.(response), 250);
    },
  },
  storage: {
    local: {
      get: async (keys: unknown) => pick(keys),
      set: async (items: Record<string, unknown>) => {
        Object.assign(store, structuredClone(items));
        onChanged.fire(items, 'local');
      },
      remove: async (keys: string | string[]) => {
        for (const k of typeof keys === 'string' ? [keys] : keys) delete store[k];
        onChanged.fire({}, 'local');
      },
    },
    onChanged,
  },
  permissions: {
    contains: async (p: { origins?: string[] }) => (p.origins ?? []).every((o) => granted.has(o)),
    request: async (p: { origins?: string[] }) => {
      (p.origins ?? []).forEach((o) => granted.add(o));
      onAdded.fire(p);
      return true;
    },
    onAdded,
    onRemoved: events(),
  },
  tabs: {
    create: async (p: { url?: string }) => {
      (globalThis as Record<string, unknown>).__lastTabUrl = p.url;
      return { id: 99 };
    },
    getCurrent: async () => ({ id: 1 }),
    update: async () => undefined,
    remove: async () => undefined,
    query: async () => [],
    onUpdated: events(),
    onRemoved: events(),
  },
};
