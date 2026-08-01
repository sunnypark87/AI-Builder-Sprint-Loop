import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/partner/plans/upload-url/route';

describe('POST /api/partner/plans/upload-url', () => {
  it('rejects files above the documented 10MB limit before external access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/plans/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: '22222222-2222-4222-8222-222222222222',
          donationId: '33333333-3333-4333-8333-333333333333',
          fileName: 'plan.pdf',
          mimeType: 'application/pdf',
          size: 10 * 1024 * 1024 + 1,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_file', retryable: false },
    });
  });

  it('rejects malformed JSON before external access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/plans/upload-url', {
        method: 'POST',
        body: 'not-json',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request', retryable: false },
    });
  });
});
