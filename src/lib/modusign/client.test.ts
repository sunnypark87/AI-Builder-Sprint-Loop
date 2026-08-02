import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createModusignClient } from './client';

describe('Modusign server client', () => {
  beforeEach(() => {
    vi.stubEnv('MODUSIGN_AUTH_KEY', 'encoded-auth-key');
    vi.stubEnv('MODUSIGN_TEMPLATE_ID', 'template-from-env');
    vi.stubGlobal('fetch', vi.fn());
  });

  it('uses MODUSIGN_AUTH_KEY and validates a document response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'document-1',
          participants: [],
          signings: [],
          status: 'ON_GOING',
          title: 'pledge',
        }),
        { status: 201 },
      ),
    );

    const result = await createModusignClient().createDocumentWithTemplate({
      document: { title: 'pledge' },
    });

    expect(result.id).toBe('document-1');
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.modusign.co.kr/documents/request-with-template',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Basic encoded-auth-key',
        }),
      }),
    );
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual(
      {
        document: { title: 'pledge' },
        templateId: 'template-from-env',
      },
    );
  });

  it('converts upstream failures to safe errors without exposing response text', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('secret upstream details', { status: 401 }),
    );

    await expect(
      createModusignClient().getDocument('document-1'),
    ).rejects.toMatchObject({
      code: 'request_failed',
      status: 401,
    });
    await expect(
      createModusignClient().getDocument('document-1'),
    ).rejects.not.toThrow('secret upstream details');
  });

  it('rejects malformed responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 'missing-fields' }), { status: 200 }),
    );

    await expect(
      createModusignClient().getDocument('document-1'),
    ).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('finds document details with encoded metadata filters', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ documents: [{ id: 'document-1' }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'document-1',
            participants: [],
            signings: [],
            status: 'ON_GOING',
            title: 'pledge',
          }),
          { status: 200 },
        ),
      );

    const documents = await createModusignClient().findDocumentsByMetadata({
      pledge_id: 'pledge-1',
    });

    expect(documents.map((document) => document.id)).toEqual(['document-1']);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
      'metadatas=%7B%22pledge_id%22%3A%22pledge-1%22%7D',
    );
  });
});
