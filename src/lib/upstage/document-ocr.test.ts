import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseDocumentOcrResponse,
  recognizePlanDocument,
} from '@/lib/upstage/document-ocr';

const plan = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'plan.png', {
  type: 'image/png',
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseDocumentOcrResponse', () => {
  it('keeps only validated OCR page data', () => {
    expect(
      parseDocumentOcrResponse({
        apiVersion: '1.1',
        modelVersion: 'ocr-test',
        pages: [
          {
            page: 1,
            text: '계획명: 교육 지원',
            confidence: 0.99,
            words: [{ text: 'ignored by this boundary' }],
          },
        ],
      }),
    ).toEqual({
      apiVersion: '1.1',
      modelVersion: 'ocr-test',
      pages: [
        {
          page: 1,
          text: '계획명: 교육 지원',
          confidence: 0.99,
        },
      ],
    });
  });

  it('rejects malformed pages', () => {
    expect(() =>
      parseDocumentOcrResponse({
        apiVersion: '1.1',
        modelVersion: 'ocr-test',
        pages: [{ page: 1 }],
      }),
    ).toThrowError(expect.objectContaining({ code: 'invalid_response' }));
  });
});

describe('recognizePlanDocument', () => {
  it('sends the API key only in the upstream authorization header', async () => {
    vi.stubEnv('UPSTAGE_MODEL', 'solar-pro3');
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        apiVersion: '1.1',
        modelVersion: 'ocr-test',
        pages: [{ page: 1, text: '계획명: 교육 지원' }],
      }),
    );

    await recognizePlanDocument(plan, {
      apiKey: 'secret-test-key',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, request] = fetchImpl.mock.calls[0];
    expect(request?.headers).toEqual({
      Authorization: 'Bearer secret-test-key',
    });
    expect(request?.body).toBeInstanceOf(FormData);
    expect((request?.body as FormData).get('model')).toBe('ocr');
  });

  it('maps rate limits to a retryable safe error', async () => {
    const request = recognizePlanDocument(plan, {
      apiKey: 'secret-test-key',
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 429 })),
    });

    await expect(request).rejects.toMatchObject({
      code: 'rate_limited',
      retryable: true,
      status: 429,
    });
    await expect(request).rejects.not.toThrow('secret-test-key');
  });

  it.each([
    [400, 'invalid_request', false],
    [401, 'authentication_failed', false],
    [403, 'authentication_failed', false],
    [404, 'upstream_rejected', false],
    [413, 'payload_too_large', false],
    [422, 'upstream_rejected', false],
    [500, 'upstream_failure', true],
  ])(
    'maps upstream status %i to %s without exposing response details',
    async (status, code, retryable) => {
      const request = recognizePlanDocument(plan, {
        apiKey: 'secret-test-key',
        fetchImpl: vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response('upstream-secret-detail', { status }),
          ),
      });

      await expect(request).rejects.toMatchObject({
        code,
        retryable,
        status,
      });
      await expect(request).rejects.not.toThrow('upstream-secret-detail');
    },
  );

  it('maps an aborted request to a retryable timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );

    await expect(
      recognizePlanDocument(plan, {
        apiKey: 'secret-test-key',
        fetchImpl,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({
      code: 'timeout',
      retryable: true,
    });
  });

  it('rejects a successful response whose body is not JSON', async () => {
    await expect(
      recognizePlanDocument(plan, {
        apiKey: 'secret-test-key',
        fetchImpl: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response('not-json', { status: 200 })),
      }),
    ).rejects.toMatchObject({
      code: 'invalid_response',
      retryable: true,
    });
  });

  it('fails before the network when the API key is missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      recognizePlanDocument(plan, { apiKey: '', fetchImpl }),
    ).rejects.toMatchObject({
      code: 'missing_api_key',
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
