import { describe, expect, it } from 'vitest';
import { createChatGptClient, readSseEvents } from '@/lib/llm/chatgpt';
import { LlmError } from '@/lib/llm/types';

const enc = new TextEncoder();
function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}
const sse = (obj: object) => `event: ${(obj as { type: string }).type}\ndata: ${JSON.stringify(obj)}\n\n`;
const okStream = (text: string) =>
  new Response(streamOf(sse({ type: 'response.output_text.delta', delta: text.slice(0, 5) }), sse({ type: 'response.output_text.delta', delta: text.slice(5) }), sse({ type: 'response.completed', response: {} })), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
const jsonResponse = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const call = { system: 'SYSTEM', context: 'CONTEXT', user: 'USER', schema: { type: 'object' }, maxTokens: 1000 };

function client(responses: Response[], seen: Array<{ url: string; init: RequestInit }>) {
  return createChatGptClient({
    getAccessToken: async () => 'token-1',
    model: 'gpt-6.1-sol',
    thinking: 'medium',
    fetch: async (url, init) => {
      seen.push({ url: String(url), init: init ?? {} });
      const next = responses.shift();
      if (!next) throw new Error('no more responses');
      return next;
    },
  });
}

describe('readSseEvents', () => {
  it('parses events split across chunks and skips [DONE]', async () => {
    const events: unknown[] = [];
    for await (const e of readSseEvents(streamOf('event: a\ndata: {"type":"a","n"', ':1}\n\nevent: b\r\ndata: {"type":"b"}\r\n\r\ndata: [DONE]\n\n'))) events.push(e);
    expect(events).toEqual([{ type: 'a', n: 1 }, { type: 'b' }]);
  });
});

describe('ChatGPT plan client', () => {
  it('streams a Responses request with only the fields this route accepts', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const result = await client([okStream('{"a":"b"}')], seen).callStructured(call);
    expect(result.json).toEqual({ a: 'b' });
    expect(seen[0]!.url).toBe('https://api.openai.com/v1/responses');
    const headers = new Headers(seen[0]!.init.headers);
    expect(headers.get('authorization')).toBe('Bearer token-1');
    const body = JSON.parse(String(seen[0]!.init.body));
    expect(body).toMatchObject({ model: 'gpt-6.1-sol', store: false, stream: true, instructions: 'SYSTEM\n\nCONTEXT', input: [{ role: 'user', content: 'USER' }] });
    expect(body.text.format.type).toBe('json_schema');
    expect(body.reasoning).toEqual({ effort: 'medium' });
    for (const field of ['max_output_tokens', 'temperature', 'top_p', 'metadata', 'user', 'truncation']) expect(body).not.toHaveProperty(field);
  });

  it('drops structured output when the route says it is unsupported, and remembers that', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const unsupported = jsonResponse(400, { error: { code: 'subscription_sharing_unsupported_capability', param: 'text.format', message: 'unsupported' } });
    const c = client([unsupported, okStream('{"a":"b"}'), okStream('{"c":"d"}')], seen);
    expect((await c.callStructured(call)).json).toEqual({ a: 'b' });
    expect((await c.callStructured(call)).json).toEqual({ c: 'd' });
    expect(JSON.parse(String(seen[1]!.init.body)).text).toBeUndefined();
    expect(JSON.parse(String(seen[2]!.init.body)).text).toBeUndefined();
  });

  it('reports the plan usage limit, even when it arrives inside the stream', async () => {
    const failed = new Response(streamOf(sse({ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'limit' } } })), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    await expect(client([failed], []).callStructured(call)).rejects.toMatchObject({ code: 'usage_limit' });
    await expect(client([jsonResponse(429, { error: { code: 'subscription_sharing_usage_limit_exceeded' } })], []).callStructured(call)).rejects.toMatchObject({ code: 'usage_limit' });
  });

  it('maps an expired sign-in and an ineligible account', async () => {
    await expect(client([jsonResponse(401, { detail: 'no' })], []).callStructured(call)).rejects.toMatchObject({ code: 'signed_out' });
    await expect(client([jsonResponse(403, { error: { code: 'subscription_sharing_user_not_eligible' } })], []).callStructured(call)).rejects.toMatchObject({ code: 'not_eligible' });
  });

  it('treats a stream that ends early as a retryable network error', async () => {
    const cut = new Response(streamOf(sse({ type: 'response.output_text.delta', delta: '{"a"' })), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    const err = await client([cut], []).callStructured(call).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.retryable).toBe(true);
  });
});
