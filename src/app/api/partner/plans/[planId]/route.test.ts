import { describe, expect, it } from 'vitest';

import { GET, PATCH } from '@/app/api/partner/plans/[planId]/route';

describe('/api/partner/plans/[planId]', () => {
  it('rejects an invalid plan identifier before storage access', async () => {
    const response = await GET(
      new Request('http://localhost/api/partner/plans/not-a-uuid'),
      { params: Promise.resolve({ planId: 'not-a-uuid' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_identifier' },
    });
  });

  it('rejects malformed registration JSON', async () => {
    const response = await PATCH(
      new Request(
        'http://localhost/api/partner/plans/44444444-4444-4444-8444-444444444444',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        },
      ),
      {
        params: Promise.resolve({
          planId: '44444444-4444-4444-8444-444444444444',
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_json' },
    });
  });
});
