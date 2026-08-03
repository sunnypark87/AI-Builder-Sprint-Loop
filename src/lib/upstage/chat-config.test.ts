import { describe, expect, it } from 'vitest';
import { getUpstageChatConfig, UpstageChatConfigError } from './chat-config';

describe('upstage chat config', () => {
  it('uses the production-safe defaults', () => {
    expect(getUpstageChatConfig({ UPSTAGE_API_KEY: 'secret' })).toEqual({
      apiKey: 'secret',
      baseUrl: 'https://api.upstage.ai/v1',
      model: 'solar-pro3',
      timeoutMs: 15000,
    });
  });
  it('rejects missing keys and invalid timeouts', () => {
    expect(() => getUpstageChatConfig({})).toThrow(UpstageChatConfigError);
    expect(() =>
      getUpstageChatConfig({
        UPSTAGE_API_KEY: 'secret',
        UPSTAGE_CHAT_TIMEOUT_MS: '100',
      }),
    ).toThrow(UpstageChatConfigError);
  });
});
