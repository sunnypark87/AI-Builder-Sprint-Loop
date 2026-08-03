import { afterEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/partner/reports/route';

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

describe('POST /api/partner/reports', () => {
  it('rejects invalid JSON before authentication or AI access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/reports', {
        method: 'POST',
        body: 'not-json',
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_json', retryable: false },
    });
  });

  it('rejects invalid identifiers before authentication or AI access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId: 'invalid',
          planId: 'invalid',
          idempotencyKey: 'report-test-1234567890',
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_request' },
    });
  });

  it('does not disclose environment variable names when storage is unavailable', async () => {
    for (const name of names) delete process.env[name];
    const response = await POST(
      new Request('http://localhost/api/partner/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId: '22222222-2222-4222-8222-222222222222',
          planId: '44444444-4444-4444-8444-444444444444',
          idempotencyKey: 'report-test-1234567890',
        }),
      }),
    );
    expect(response.status).toBe(503);
    const result = await response.json();
    expect(result.error.code).toBe('service_unavailable');
    expect(JSON.stringify(result)).not.toContain('SUPABASE');
  });
});
