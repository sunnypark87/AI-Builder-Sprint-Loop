import { afterEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/partner/executions/route';

const names = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
] as const;
const original = Object.fromEntries(
  names.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of names) {
    const value = original[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('POST /api/partner/executions', () => {
  it('rejects invalid JSON before external access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/executions', {
        method: 'POST',
        body: 'not-json',
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_file', retryable: false },
    });
  });

  it('does not disclose configuration names when Supabase is unavailable', async () => {
    for (const name of names) delete process.env[name];
    const response = await POST(
      new Request('http://localhost/api/partner/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: '22222222-2222-4222-8222-222222222222',
          donationId: '33333333-3333-4333-8333-333333333333',
          planId: '44444444-4444-4444-8444-444444444444',
          planItemId: '55555555-5555-4555-8555-555555555555',
          idempotencyKey: 'execution-submit-1234567890',
          sourcePath:
            '22222222-2222-4222-8222-222222222222/pending/11111111-1111-4111-8111-111111111111/66666666-6666-4666-8666-666666666666/source.png',
          fileName: 'receipt.png',
          mimeType: 'image/png',
        }),
      }),
    );
    expect(response.status).toBe(503);
    const result = await response.json();
    expect(result.error.code).toBe('service_unavailable');
    expect(JSON.stringify(result)).not.toContain('SUPABASE');
  });
});
