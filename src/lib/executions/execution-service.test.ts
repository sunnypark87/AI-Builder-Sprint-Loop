import { describe, expect, it, vi } from 'vitest';

import type {
  ExecutionEligibility,
  ExecutionRepository,
} from '@/lib/executions/execution-repository';
import {
  analyzeExecution,
  ExecutionServiceError,
} from '@/lib/executions/execution-service';

const ids = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  donationId: '33333333-3333-4333-8333-333333333333',
  planId: '44444444-4444-4444-8444-444444444444',
  planItemId: '55555555-5555-4555-8555-555555555555',
  uploadId: '66666666-6666-4666-8666-666666666666',
  executionId: '77777777-7777-4777-8777-777777777777',
};

const eligibility: ExecutionEligibility = {
  organizationId: ids.organizationId,
  donationId: ids.donationId,
  planId: ids.planId,
  planTitle: '8월 급식 계획',
  planItemId: ids.planItemId,
  planItemName: '식재료',
  planPeriodStart: '2026-08-01',
  planPeriodEnd: '2026-08-31',
  donationPaidAt: '2026-07-31T10:00:00Z',
  planItemAmount: 10000,
  remainingBudget: 10000,
};

function pngFile() {
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    'receipt.png',
    { type: 'image/png' },
  );
}

function repository(overrides: Partial<ExecutionRepository> = {}) {
  const base: ExecutionRepository = {
    getEligibility: vi.fn().mockResolvedValue(eligibility),
    listEligible: vi.fn().mockResolvedValue([]),
    createAnalyzingExecution: vi.fn().mockResolvedValue({
      id: ids.executionId,
      status: 'analyzing',
      draft: null,
      issues: [],
      verificationResults: [],
      sourcePath: null,
      shouldProcess: true,
    }),
    downloadPendingSource: vi.fn().mockResolvedValue(pngFile()),
    promoteSource: vi
      .fn()
      .mockResolvedValue(`${ids.organizationId}/${ids.executionId}/source.png`),
    removeSource: vi.fn().mockResolvedValue(undefined),
    saveAnalysis: vi.fn().mockResolvedValue('review_required'),
    saveFailure: vi.fn().mockResolvedValue(undefined),
    verificationContext: vi.fn().mockResolvedValue({
      planPeriodStart: eligibility.planPeriodStart,
      planPeriodEnd: eligibility.planPeriodEnd,
      donationPaidAt: eligibility.donationPaidAt,
      remainingBudget: 10000,
      duplicateSource: false,
      duplicateTransaction: false,
      sourceFingerprint: 'a'.repeat(64),
    }),
    getReview: vi.fn().mockResolvedValue(null),
    register: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    claimRetry: vi.fn().mockResolvedValue(null),
    downloadSource: vi.fn().mockResolvedValue(pngFile()),
  };
  return { ...base, ...overrides };
}

const input = {
  ...ids,
  idempotencyKey: 'execution-submit-1234567890',
  sourcePath: `${ids.organizationId}/pending/${ids.userId}/${ids.uploadId}/source.png`,
  fileName: 'receipt.png',
  mimeType: 'image/png',
};

describe('analyzeExecution', () => {
  it('analyzes a supported receipt and saves deterministic verification results', async () => {
    const target = repository();
    const result = await analyzeExecution(input, {
      repository: target,
      recognize: vi.fn().mockResolvedValue({
        apiVersion: '1',
        modelVersion: 'test',
        pages: [
          {
            page: 1,
            confidence: 0.99,
            text: [
              '상호명: 모두마트',
              '사업자등록번호: 120-81-55297',
              '거래일시: 2026.08.02 14:30',
              '품목: 생수 | 수량 2 | 금액 2,000원',
              '공급가액: 1,819원',
              '부가세: 181원',
              '합계: 2,000원',
              '승인번호: 12345678',
            ].join('\n'),
          },
        ],
      }),
      now: () => new Date('2026-08-02T00:00:00Z'),
    });

    expect(result.status).toBe('review_required');
    expect(result.parsed?.draft.totalAmount).toBe(2000);
    expect(target.saveAnalysis).toHaveBeenCalledWith(
      ids.executionId,
      expect.stringContaining(ids.executionId),
      expect.objectContaining({
        draft: expect.objectContaining({ merchantName: '모두마트' }),
      }),
      expect.arrayContaining([
        expect.objectContaining({
          code: 'remaining_budget',
          outcome: 'passed',
        }),
      ]),
      '1208155297:2026-08-02T14:30:2000:12345678',
    );
  });

  it('rejects an unauthorized plan item and removes the pending source', async () => {
    const target = repository({
      getEligibility: vi.fn().mockResolvedValue(null),
    });
    await expect(
      analyzeExecution(input, { repository: target }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ExecutionServiceError>>({
        code: 'forbidden',
        httpStatus: 403,
      }),
    );
    expect(target.removeSource).toHaveBeenCalledWith(input.sourcePath);
  });

  it('rejects an invalid pending path before storage access', async () => {
    const target = repository();
    await expect(
      analyzeExecution(
        { ...input, sourcePath: '../receipt.png' },
        { repository: target },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ExecutionServiceError>>({
        code: 'invalid_file',
      }),
    );
    expect(target.downloadPendingSource).not.toHaveBeenCalled();
  });
});
