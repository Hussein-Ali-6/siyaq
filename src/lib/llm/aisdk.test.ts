import { describe, expect, it } from 'vitest';
import { aiSdkProviderOptions, createAiSdkClient } from '@/lib/llm/aisdk';

describe('aiSdkProviderOptions', () => {
  it('maps the thinking level onto each provider', () => {
    expect(aiSdkProviderOptions('openai', 'low')).toEqual({ openai: { reasoningEffort: 'low' } });
    expect(aiSdkProviderOptions('google', 'high')).toEqual({ google: { thinkingConfig: { thinkingLevel: 'high' } } });
    expect(aiSdkProviderOptions('openrouter', 'medium')).toEqual({ openrouter: { reasoning: { effort: 'medium' } } });
  });
});

const responsesReply = (text: string) =>
  new Response(
    JSON.stringify({
      id: 'resp_1',
      created_at: 1,
      model: 'gpt-x',
      output: [{ type: 'message', role: 'assistant', id: 'msg_1', content: [{ type: 'output_text', text, annotations: [] }] }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const call = { system: 'SYSTEM PROMPT', context: 'PAGE CONTEXT', user: 'USER MESSAGE', schema: { type: 'object', additionalProperties: false, required: ['a'], properties: { a: { type: 'string' } } }, maxTokens: 1000 };

describe('AI SDK client (OpenAI)', () => {
  it('asks for structured output with the thinking level and returns the parsed answer', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const c = createAiSdkClient('openai', {
      apiKey: 'sk-test',
      model: 'gpt-6.1-mini',
      thinking: 'low',
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return responsesReply('{"a":"b"}');
      },
    });
    const result = await c.callStructured(call);
    expect(result.json).toEqual({ a: 'b' });
    const sent = JSON.stringify(bodies[0]);
    expect(sent).toContain('SYSTEM PROMPT');
    expect(sent).toContain('PAGE CONTEXT');
    expect(sent).toContain('USER MESSAGE');
    expect((bodies[0]!.text as { format: { type: string } }).format.type).toBe('json_schema');
    expect(bodies[0]!.reasoning).toMatchObject({ effort: 'low' });
  });

  it('retries once without the thinking option when the model does not support it', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const replies = [
      new Response(JSON.stringify({ error: { message: "Unsupported parameter: 'reasoning.effort' is not supported with this model.", type: 'invalid_request_error', param: 'reasoning.effort', code: 'unsupported_parameter' } }), { status: 400, headers: { 'content-type': 'application/json' } }),
      responsesReply('{"a":"c"}'),
    ];
    const c = createAiSdkClient('openai', {
      apiKey: 'sk-test',
      model: 'gpt-6.1-mini',
      thinking: 'medium',
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return replies.shift()!;
      },
    });
    expect((await c.callStructured(call)).json).toEqual({ a: 'c' });
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.reasoning).toBeUndefined();
  });

  it('maps a rejected key to bad_key', async () => {
    const c = createAiSdkClient('openai', {
      apiKey: 'sk-bad',
      model: 'gpt-x',
      thinking: 'low',
      fetch: async () => new Response(JSON.stringify({ error: { message: 'Incorrect API key', type: 'invalid_request_error', code: 'invalid_api_key' } }), { status: 401, headers: { 'content-type': 'application/json' } }),
    });
    await expect(c.callStructured(call)).rejects.toMatchObject({ code: 'bad_key' });
  });
});
