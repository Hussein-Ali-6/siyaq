import { describe, expect, it } from 'vitest';
import { LlmError } from './types';

describe('LlmError.keyRejected', () => {
  it('is true when the provider says the key itself is wrong', () => {
    expect(new LlmError('bad_key', 'The API key was rejected.', 401).keyRejected).toBe(true);
  });

  it('is false when a valid key is refused something, and for other failures', () => {
    expect(new LlmError('bad_key', 'This API key is not allowed to use the model.', 403).keyRejected).toBe(false);
    expect(new LlmError('network', 'Could not reach the provider.').keyRejected).toBe(false);
    expect(new LlmError('rate_limited', 'Rate limit reached.', 429).keyRejected).toBe(false);
  });
});
