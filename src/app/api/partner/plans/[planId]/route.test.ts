import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getReview, register } = vi.hoisted(() => ({
  getReview: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@/lib/plans/plan-repository', () => ({
  createPlanRepository: () => ({ getReview, register }),
}));

vi.mock('@/lib/supabase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/auth')>()),
  requireUserId: vi
    .fn()
    .mockResolvedValue('11111111-1111-4111-8111-111111111111'),
}));

vi.mock('@/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/server')>()),
  createClient: vi.fn().mockResolvedValue({}),
  createServiceClient: vi.fn().mockReturnValue({}),
}));

import { GET, PATCH } from '@/app/api/partner/plans/[planId]/route';

const planId = '44444444-4444-4444-8444-444444444444';
const registeredDraft = {
  title: '2026년 교육 지원',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  totalAmount: 100_000,
  items: [
    {
      id: 'item-1',
      name: '교재비',
      description: '',
      amount: 100_000,
      confidence: 0.98,
      sourceText: '교재비 100,000원',
      sourceName: '교재비',
      sourceAmount: 100_000,
    },
  ],
};

beforeEach(() => {
  getReview.mockReset();
  register.mockReset();
});

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

  it('rejects changes to an already registered plan', async () => {
    getReview.mockResolvedValue({
      id: planId,
      status: 'registered',
      draft: registeredDraft,
    });
    const changedDraft = {
      ...registeredDraft,
      title: '변경된 교육 지원 계획',
    };

    const response = await PATCH(
      new Request(`http://localhost/api/partner/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: changedDraft }),
      }),
      { params: Promise.resolve({ planId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'already_registered', retryable: false },
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('accepts an identical registered draft as an idempotent retry', async () => {
    getReview.mockResolvedValue({
      id: planId,
      status: 'registered',
      draft: registeredDraft,
    });

    const response = await PATCH(
      new Request(`http://localhost/api/partner/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: registeredDraft }),
      }),
      { params: Promise.resolve({ planId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      planId,
      status: 'registered',
    });
    expect(register).not.toHaveBeenCalled();
  });
});
