import { afterEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/partner/plans/route';

const supabaseEnvironmentNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
] as const;
const originalEnvironment = Object.fromEntries(
  supabaseEnvironmentNames.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of supabaseEnvironmentNames) {
    const value = originalEnvironment[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe('POST /api/partner/plans', () => {
  it('rejects a request without uploaded document metadata before external access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/plans', {
        method: 'POST',
        body: 'not-json',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_file',
        retryable: false,
      },
    });
  });

  it('returns a safe unavailable response when Supabase is not configured', async () => {
    for (const name of supabaseEnvironmentNames) {
      delete process.env[name];
    }
    const response = await POST(
      new Request('http://localhost/api/partner/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: '22222222-2222-4222-8222-222222222222',
          donationId: '33333333-3333-4333-8333-333333333333',
          idempotencyKey: 'plan-submit-1234567890',
          sourcePath:
            '22222222-2222-4222-8222-222222222222/pending/11111111-1111-4111-8111-111111111111/55555555-5555-4555-8555-555555555555/source.png',
          fileName: 'plan.png',
          mimeType: 'image/png',
        }),
      }),
    );

    expect(response.status).toBe(503);
    const result = await response.json();
    expect(result).toEqual({
      error: {
        code: 'service_unavailable',
        message: '집행 계획 저장소가 구성되지 않았습니다.',
        retryable: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain('SUPABASE');
  });
});
