import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createManualPlan: vi.fn(),
  requireUserId: vi.fn(),
}));

vi.mock('@/lib/plans/plan-repository', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/plans/plan-repository')>();
  return {
    ...original,
    createPlanRepository: () => ({
      createManualPlan: mocks.createManualPlan,
    }),
  };
});

vi.mock('@/lib/supabase/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase/auth')>();
  return { ...original, requireUserId: mocks.requireUserId };
});

vi.mock('@/lib/supabase/server', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/supabase/server')>();
  return {
    ...original,
    createClient: vi.fn().mockResolvedValue({}),
    createServiceClient: vi.fn().mockReturnValue({}),
  };
});

import { POST } from '@/app/api/partner/plans/route';

const requestDraft = {
  title: '  8월 급식 계획  ',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  totalAmount: 200_000,
  items: [
    {
      id: 'item-1',
      name: '  식재료  ',
      description: '  급식 재료 구입  ',
      amount: 200_000,
      confidence: 1,
      sourceText: '조작된 OCR 원문',
      sourceName: '조작된 항목',
      sourceAmount: 1,
    },
  ],
};

function manualRequest(draft: unknown = requestDraft) {
  return new Request('http://localhost/api/partner/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'manual',
      organizationId: '22222222-2222-4222-8222-222222222222',
      donationId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'manual-plan:55555555-5555-4555-8555-555555555555',
      draft,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue('11111111-1111-4111-8111-111111111111');
  mocks.createManualPlan.mockResolvedValue({
    id: '44444444-4444-4444-8444-444444444444',
    created: true,
  });
});

describe('POST /api/partner/plans manual mode', () => {
  it('registers a valid manual draft and discards client OCR provenance', async () => {
    const response = await POST(manualRequest());

    expect(response.status).toBe(201);
    expect(mocks.createManualPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '22222222-2222-4222-8222-222222222222',
        donationId: '33333333-3333-4333-8333-333333333333',
        draft: expect.objectContaining({
          title: '8월 급식 계획',
          items: [
            expect.objectContaining({
              name: '식재료',
              description: '급식 재료 구입',
              confidence: null,
              sourceText: '',
              sourceName: '',
              sourceAmount: null,
            }),
          ],
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      status: 'registered',
      duplicate: false,
    });
  });

  it('returns validation issues before persistence', async () => {
    const response = await POST(
      manualRequest({ ...requestDraft, totalAmount: 100_000 }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_failed', retryable: false },
      issues: [{ code: 'total_amount_mismatch' }],
    });
    expect(mocks.createManualPlan).not.toHaveBeenCalled();
  });
});
