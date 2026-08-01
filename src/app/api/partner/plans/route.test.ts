import { afterEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/partner/plans/route';

const supabaseEnvironmentNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
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
  it('rejects a request without a document before external access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/plans', {
        method: 'POST',
        body: new FormData(),
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
    const body = new FormData();
    body.set(
      'document',
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        'plan.png',
        { type: 'image/png' },
      ),
    );

    const response = await POST(
      new Request('http://localhost/api/partner/plans', {
        method: 'POST',
        body,
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
