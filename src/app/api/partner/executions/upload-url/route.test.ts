import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/partner/executions/upload-url/route';

describe('POST /api/partner/executions/upload-url', () => {
  it('rejects unsupported metadata before authentication or storage access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/executions/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: 'not-a-uuid',
          mimeType: 'text/plain',
          size: 1,
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_file', retryable: false },
    });
  });
});
