import { afterEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  getReview: vi.fn(),
  getEligibility: vi.fn(),
  verificationContext: vi.fn(),
  register: vi.fn(),
}));

vi.mock('@/lib/supabase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/auth')>()),
  requireUserId: vi
    .fn()
    .mockResolvedValue('22222222-2222-4222-8222-222222222222'),
}));
vi.mock('@/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/server')>()),
  createClient: vi.fn().mockResolvedValue({}),
  createServiceClient: vi.fn().mockReturnValue({}),
}));
vi.mock('@/lib/executions/execution-repository', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/lib/executions/execution-repository')
  >()),
  createExecutionRepository: vi.fn().mockReturnValue(repository),
}));

import { PATCH } from '@/app/api/partner/executions/[executionId]/route';

const executionId = '11111111-1111-4111-8111-111111111111';
const planItemId = '55555555-5555-4555-8555-555555555555';
const replacementPlanItemId = '66666666-6666-4666-8666-666666666666';
const validDraft = {
  merchantName: '모두마트',
  businessNumber: '1208155297',
  transactionAt: '2026-08-02T14:30',
  supplyAmount: 1819,
  taxAmount: 181,
  totalAmount: 2000,
  paymentMethod: '카드',
  approvalNumber: '12345678',
  items: [
    {
      id: 'item-1',
      name: '생수',
      quantity: 2,
      amount: 2000,
      confidence: 0.9,
      sourceText: '품목: 생수',
      sourceName: '생수',
      sourceAmount: 2000,
    },
  ],
};

afterEach(() => {
  for (const mock of Object.values(repository)) mock.mockReset();
});

describe('PATCH /api/partner/executions/[executionId]', () => {
  it.each([
    ['paymentMethod', '카'.repeat(101), 'payment_method_too_long'],
    ['approvalNumber', '1'.repeat(41), 'approval_number_too_long'],
  ])(
    'returns 422 before persistence when %s exceeds its DB limit',
    async (field, value, issueCode) => {
      const response = await PATCH(
        new Request(`http://localhost/api/partner/executions/${executionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draft: { ...validDraft, [field]: value },
            planItemId,
            warningReason: '',
          }),
        }),
        { params: Promise.resolve({ executionId }) },
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'validation_failed', retryable: false },
        issues: [{ code: issueCode, path: field }],
      });
    },
  );

  it('returns 422 before persistence for a nonexistent transaction date', async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/partner/executions/${executionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: { ...validDraft, transactionAt: '2026-02-30T10:00' },
          planItemId,
          warningReason: '',
        }),
      }),
      { params: Promise.resolve({ executionId }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_failed', retryable: false },
      issues: [{ code: 'transaction_at_invalid', path: 'transactionAt' }],
    });
  });

  it('preserves server-owned OCR provenance when registering edited values', async () => {
    const serverDraft = {
      ...validDraft,
      items: [
        {
          ...validDraft.items[0],
          confidence: 0.2,
          sourceText: '품목: 생수 2개 2,000원',
          sourceName: '생수',
          sourceAmount: 2000,
        },
      ],
    };
    repository.getReview.mockResolvedValue({
      id: executionId,
      organizationId: '22222222-2222-4222-8222-222222222222',
      donationId: '33333333-3333-4333-8333-333333333333',
      planId: '44444444-4444-4444-8444-444444444444',
      planItemId,
      status: 'verification_warning',
      draft: serverDraft,
      sourceFingerprint: 'a'.repeat(64),
    });
    repository.getEligibility.mockResolvedValue({
      organizationId: '22222222-2222-4222-8222-222222222222',
      donationId: '33333333-3333-4333-8333-333333333333',
      planId: '44444444-4444-4444-8444-444444444444',
      planItemId: replacementPlanItemId,
      planPeriodStart: '2026-08-01',
      planPeriodEnd: '2026-08-31',
      donationPaidAt: '2026-08-01T00:00:00Z',
      remainingBudget: 10000,
    });
    repository.verificationContext.mockResolvedValue({
      planPeriodStart: '2026-08-01',
      planPeriodEnd: '2026-08-31',
      donationPaidAt: '2026-08-01T00:00:00Z',
      remainingBudget: 10000,
      duplicateSource: false,
      duplicateTransaction: false,
      sourceFingerprint: 'a'.repeat(64),
    });
    repository.register.mockResolvedValue(undefined);

    const response = await PATCH(
      new Request(`http://localhost/api/partner/executions/${executionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: {
            ...validDraft,
            merchantName: '수정마트',
            items: [
              {
                ...validDraft.items[0],
                name: '수정 생수',
                confidence: 1,
                sourceText: 'fabricated',
                sourceName: 'fabricated',
                sourceAmount: 1,
              },
            ],
          },
          planItemId: replacementPlanItemId,
          warningReason: '낮은 신뢰도를 원본과 대조했습니다.',
        }),
      }),
      { params: Promise.resolve({ executionId }) },
    );

    expect(response.status).toBe(200);
    expect(repository.register).toHaveBeenCalledWith(
      executionId,
      replacementPlanItemId,
      expect.objectContaining({
        merchantName: '수정마트',
        items: [
          expect.objectContaining({
            name: '수정 생수',
            confidence: 0.2,
            sourceText: '품목: 생수 2개 2,000원',
            sourceName: '생수',
            sourceAmount: 2000,
          }),
        ],
      }),
      expect.arrayContaining([
        expect.objectContaining({ code: 'ocr_review', outcome: 'warning' }),
      ]),
      '낮은 신뢰도를 원본과 대조했습니다.',
    );
    expect(repository.getEligibility).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      replacementPlanItemId,
    );
  });

  it.each([
    [
      'a concurrent reviewer registered different values first',
      'Execution already registered with different review',
      'already_registered',
    ],
    [
      'the donation became ineligible before the transaction',
      'Execution donation is not eligible',
      'invalid_reference',
    ],
  ])('returns 409 when %s', async (_scenario, databaseMessage, errorCode) => {
    repository.getReview.mockResolvedValue({
      id: executionId,
      organizationId: '22222222-2222-4222-8222-222222222222',
      donationId: '33333333-3333-4333-8333-333333333333',
      planId: '44444444-4444-4444-8444-444444444444',
      planItemId,
      status: 'review_required',
      draft: validDraft,
      sourceFingerprint: 'a'.repeat(64),
    });
    repository.getEligibility.mockResolvedValue({
      organizationId: '22222222-2222-4222-8222-222222222222',
      donationId: '33333333-3333-4333-8333-333333333333',
      planId: '44444444-4444-4444-8444-444444444444',
      planItemId,
      planPeriodStart: '2026-08-01',
      planPeriodEnd: '2026-08-31',
      donationPaidAt: '2026-08-01T00:00:00Z',
      remainingBudget: 10000,
    });
    repository.verificationContext.mockResolvedValue({
      planPeriodStart: '2026-08-01',
      planPeriodEnd: '2026-08-31',
      donationPaidAt: '2026-08-01T00:00:00Z',
      remainingBudget: 10000,
      duplicateSource: false,
      duplicateTransaction: false,
      sourceFingerprint: 'a'.repeat(64),
    });
    repository.register.mockRejectedValue(
      new Error(`집행 내역 저장소 오류: ${databaseMessage}`),
    );

    const response = await PATCH(
      new Request(`http://localhost/api/partner/executions/${executionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: validDraft,
          planItemId,
          warningReason: '',
        }),
      }),
      { params: Promise.resolve({ executionId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: errorCode, retryable: false },
    });
  });
});
