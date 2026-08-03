import { describe, expect, it, vi } from 'vitest';
import { completeUpstageChat } from './chat';

const config = {
  apiKey: 'secret-key',
  baseUrl: 'https://example.test/v1',
  model: 'solar-pro3',
  timeoutMs: 1000,
};
const response = () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              assistantMessage: '확인',
              proposedPatch: {},
            }),
          },
        },
      ],
      usage: { total_tokens: 4 },
    }),
    { status: 200, headers: { 'x-request-id': 'req-1' } },
  );

describe('upstage chat client', () => {
  it('sends a server-only bearer request and parses the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response());
    const result = await completeUpstageChat({
      config,
      fetchImpl,
      messages: [{ role: 'user', content: '{}' }],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/v1/chat/completions',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer secret-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      response_format: { type: 'json_object' },
    });
    expect(result.requestId).toBe('req-1');
  });
  it('retries a rate limit once and then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(response());
    const result = await completeUpstageChat({
      config,
      fetchImpl,
      sleepImpl: async () => undefined,
      messages: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.output.assistantMessage).toBe('확인');
  });
  it('honors Retry-After while bounding the delay', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', {
          status: 429,
          headers: { 'retry-after': '2', 'x-request-id': 'req-rate' },
        }),
      )
      .mockResolvedValueOnce(response());
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    await completeUpstageChat({
      config,
      fetchImpl,
      sleepImpl,
      messages: [],
    });
    expect(sleepImpl).toHaveBeenCalledWith(2_000);
  });
  it('retries malformed JSON model output once', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'not-json' } }] }),
          { status: 200 },
        ),
      );
    await expect(
      completeUpstageChat({ config, fetchImpl, messages: [] }),
    ).rejects.toMatchObject({ code: 'invalid_response', retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('retries a timeout once and returns a safe timeout error when exhausted', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(
      completeUpstageChat({
        config,
        fetchImpl,
        sleepImpl: async () => undefined,
        messages: [],
      }),
    ).rejects.toMatchObject({ code: 'request_timeout', retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('maps authentication failures without retrying', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 401 }));
    await expect(
      completeUpstageChat({ config, fetchImpl, messages: [] }),
    ).rejects.toMatchObject({
      code: 'authentication_failed',
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
