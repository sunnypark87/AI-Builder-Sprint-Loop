import { describe, expect, it, vi } from 'vitest';

import type {
  ExistingAnalysis,
  PlanRepository,
} from '@/lib/plans/plan-repository';
import { PlanIdempotencyConflictError } from '@/lib/plans/plan-repository';
import { analyzePlan, retryPlanAnalysis } from '@/lib/plans/plan-service';
import { DocumentOcrError } from '@/lib/upstage/document-ocr';

const ids = {
  user: '11111111-1111-4111-8111-111111111111',
  organization: '22222222-2222-4222-8222-222222222222',
  donation: '33333333-3333-4333-8333-333333333333',
  plan: '44444444-4444-4444-8444-444444444444',
};

function png() {
  return new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
    'plan.png',
    { type: 'image/png' },
  );
}

function repository(overrides: Partial<PlanRepository> = {}): PlanRepository {
  return {
    assertDonationAccess: vi.fn().mockResolvedValue(true),
    createAnalyzingPlan: vi.fn().mockResolvedValue({
      id: ids.plan,
      status: 'analyzing',
      draft: null,
      issues: [],
      sourcePath: null,
      shouldProcess: true,
    }),
    downloadPendingSource: vi.fn().mockResolvedValue(png()),
    promoteSource: vi
      .fn()
      .mockResolvedValue(`${ids.organization}/${ids.plan}/source.png`),
    removeSource: vi.fn().mockResolvedValue(undefined),
    markSourceUploaded: vi.fn().mockResolvedValue(undefined),
    saveAnalysis: vi.fn().mockResolvedValue(undefined),
    saveFailure: vi.fn().mockResolvedValue(undefined),
    claimRetry: vi.fn().mockResolvedValue(null),
    getAnalysis: vi.fn().mockResolvedValue(null),
    downloadSource: vi.fn(),
    getReview: vi.fn().mockResolvedValue(null),
    register: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const input = {
  userId: ids.user,
  organizationId: ids.organization,
  donationId: ids.donation,
  idempotencyKey: 'plan-submit-1234567890',
  sourcePath: `${ids.organization}/pending/${ids.user}/55555555-5555-4555-8555-555555555555/source.png`,
  fileName: 'plan.png',
  mimeType: 'image/png',
};

describe('analyzePlan', () => {
  it('stores a validated OCR draft in review-required state', async () => {
    const store = repository();
    const result = await analyzePlan(input, {
      repository: store,
      now: () => new Date('2026-07-31T00:00:00.000Z'),
      recognize: vi.fn().mockResolvedValue({
        apiVersion: '1.1',
        modelVersion: 'ocr-test',
        pages: [
          {
            page: 1,
            confidence: 0.99,
            text: [
              '계획명: 교육 지원',
              '집행 기간: 2026-08-01 ~ 2026-08-31',
              '교재비 100,000원',
              '총 예산 100,000원',
            ].join('\n'),
          },
        ],
      }),
    });

    expect(result).toMatchObject({
      planId: ids.plan,
      status: 'review_required',
      duplicate: false,
      parsed: {
        draft: {
          title: '교육 지원',
          totalAmount: 100_000,
        },
        issues: [],
      },
    });
    expect(store.saveAnalysis).toHaveBeenCalledOnce();
    expect(store.markSourceUploaded).toHaveBeenCalledWith(
      ids.plan,
      `${ids.organization}/${ids.plan}/source.png`,
    );
    expect(store.saveFailure).not.toHaveBeenCalled();
  });

  it('returns an active existing submission without another OCR call', async () => {
    const existing: ExistingAnalysis = {
      id: ids.plan,
      status: 'review_required',
      draft: null,
      issues: [],
      sourcePath: `${ids.organization}/${ids.plan}/source.png`,
    };
    const store = repository({
      createAnalyzingPlan: vi.fn().mockResolvedValue({
        ...existing,
        shouldProcess: false,
      }),
    });
    const recognize = vi.fn();

    const result = await analyzePlan(input, {
      repository: store,
      recognize,
    });

    expect(result).toMatchObject({
      planId: ids.plan,
      status: 'review_required',
      duplicate: true,
    });
    expect(recognize).not.toHaveBeenCalled();
    expect(store.createAnalyzingPlan).toHaveBeenCalledOnce();
  });

  it('returns the winning plan when atomic creation detects a concurrent request', async () => {
    const recognize = vi.fn();
    const store = repository({
      createAnalyzingPlan: vi.fn().mockResolvedValue({
        id: ids.plan,
        status: 'analyzing',
        draft: null,
        issues: [],
        sourcePath: null,
        shouldProcess: false,
      }),
    });

    const result = await analyzePlan(input, { repository: store, recognize });

    expect(result).toMatchObject({
      planId: ids.plan,
      status: 'analyzing',
      duplicate: true,
    });
    expect(store.promoteSource).not.toHaveBeenCalled();
    expect(store.removeSource).toHaveBeenCalledWith(input.sourcePath);
    expect(recognize).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused for another source document', async () => {
    const store = repository({
      createAnalyzingPlan: vi
        .fn()
        .mockRejectedValue(new PlanIdempotencyConflictError()),
    });

    await expect(
      analyzePlan(input, { repository: store }),
    ).rejects.toMatchObject({
      code: 'invalid_file',
      httpStatus: 409,
      retryable: false,
    });
    expect(store.removeSource).toHaveBeenCalledWith(input.sourcePath);
    expect(store.promoteSource).not.toHaveBeenCalled();
  });

  it('rejects another organization donation before file processing', async () => {
    const store = repository({
      assertDonationAccess: vi.fn().mockResolvedValue(false),
    });

    await expect(
      analyzePlan(input, { repository: store }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      httpStatus: 403,
    });
    expect(store.createAnalyzingPlan).not.toHaveBeenCalled();
    expect(store.removeSource).toHaveBeenCalledWith(input.sourcePath);
  });

  it('records a safe retryable failure after an upstream timeout', async () => {
    const store = repository();

    await expect(
      analyzePlan(input, {
        repository: store,
        recognize: vi
          .fn()
          .mockRejectedValue(
            new DocumentOcrError(
              'timeout',
              '문서 분석 시간이 초과되었습니다.',
              true,
            ),
          ),
      }),
    ).rejects.toMatchObject({
      code: 'analysis_failed',
      retryable: true,
      planId: ids.plan,
    });
    expect(store.saveFailure).toHaveBeenCalledWith(
      ids.plan,
      'timeout',
      `${ids.organization}/${ids.plan}/source.png`,
    );
    expect(store.saveAnalysis).not.toHaveBeenCalled();
  });

  it('marks a source promotion failure as requiring a new upload', async () => {
    const store = repository({
      promoteSource: vi
        .fn()
        .mockRejectedValue(new Error('storage unavailable')),
    });

    await expect(
      analyzePlan(input, { repository: store }),
    ).rejects.toMatchObject({
      code: 'persistence_failed',
      retryable: false,
      planId: undefined,
    });
    expect(store.saveFailure).toHaveBeenCalledWith(
      ids.plan,
      'source_upload_failed',
      undefined,
    );
    expect(store.markSourceUploaded).not.toHaveBeenCalled();
  });
});

describe('retryPlanAnalysis', () => {
  const source = {
    planId: ids.plan,
    organizationId: ids.organization,
    sourcePath: `${ids.organization}/${ids.plan}/source.png`,
    fileName: 'plan.png',
    mimeType: 'image/png',
  };

  it('claims a failed plan and stores a new review draft from its source', async () => {
    const store = repository({
      claimRetry: vi.fn().mockResolvedValue(source),
      downloadSource: vi.fn().mockResolvedValue(png()),
    });

    const result = await retryPlanAnalysis(ids.plan, {
      repository: store,
      recognize: vi.fn().mockResolvedValue({
        apiVersion: '1.1',
        modelVersion: 'ocr-test',
        pages: [
          {
            page: 1,
            confidence: 0.99,
            text: [
              '계획명: 교육 지원',
              '집행 기간: 2026-08-01 ~ 2026-08-31',
              '교재비 100,000원',
              '총 예산 100,000원',
            ].join('\n'),
          },
        ],
      }),
    });

    expect(result.status).toBe('review_required');
    expect(store.downloadSource).toHaveBeenCalledWith(source);
    expect(store.saveAnalysis).toHaveBeenCalledOnce();
  });

  it('rejects a retry when another request already claimed the failed plan', async () => {
    const store = repository();

    await expect(
      retryPlanAnalysis(ids.plan, { repository: store }),
    ).rejects.toMatchObject({
      code: 'retry_unavailable',
      httpStatus: 409,
    });
    expect(store.downloadSource).not.toHaveBeenCalled();
  });

  it('returns an already completed retry without another OCR call', async () => {
    const completed: ExistingAnalysis = {
      id: ids.plan,
      status: 'review_required',
      draft: {
        title: '교육 지원',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
        totalAmount: 100_000,
        items: [],
      },
      issues: [],
      sourcePath: source.sourcePath,
    };
    const recognize = vi.fn();
    const store = repository({
      getAnalysis: vi.fn().mockResolvedValue(completed),
    });

    await expect(
      retryPlanAnalysis(ids.plan, { repository: store, recognize }),
    ).resolves.toMatchObject({
      planId: ids.plan,
      status: 'review_required',
      duplicate: true,
    });
    expect(recognize).not.toHaveBeenCalled();
    expect(store.downloadSource).not.toHaveBeenCalled();
  });

  it('returns the claimed plan to failed state when OCR fails again', async () => {
    const store = repository({
      claimRetry: vi.fn().mockResolvedValue(source),
      downloadSource: vi.fn().mockResolvedValue(png()),
    });

    await expect(
      retryPlanAnalysis(ids.plan, {
        repository: store,
        recognize: vi
          .fn()
          .mockRejectedValue(
            new DocumentOcrError(
              'rate_limited',
              '잠시 후 다시 시도해 주세요.',
              true,
              429,
            ),
          ),
      }),
    ).rejects.toMatchObject({
      code: 'analysis_failed',
      retryable: true,
      planId: ids.plan,
    });
    expect(store.saveFailure).toHaveBeenCalledWith(
      ids.plan,
      'rate_limited',
      source.sourcePath,
    );
  });
});
