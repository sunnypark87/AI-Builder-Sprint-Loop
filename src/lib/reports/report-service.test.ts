import { describe, expect, it, vi } from 'vitest';

import { buildReportEvidence } from './report-evidence';
import type { ReportRepository } from './report-repository';
import { createDonationReport } from './report-service';
import type { ReportContent } from './types';

const evidence = buildReportEvidence({
  organizationId: '11111111-1111-4111-8111-111111111111',
  donationId: '22222222-2222-4222-8222-222222222222',
  pledgeId: '33333333-3333-4333-8333-333333333333',
  purpose: '급식 지원',
  donationCondition: '보고',
  plan: {
    id: '44444444-4444-4444-8444-444444444444',
    title: '급식 계획',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    totalAmount: 1000,
    items: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: '식재료',
        description: '',
        amount: 1000,
      },
    ],
  },
  executions: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      planItemId: '55555555-5555-4555-8555-555555555555',
      merchantName: '상점',
      transactionDate: '2026-07-10',
      totalAmount: 1000,
    },
  ],
});

const content: ReportContent = {
  version: 1,
  title: '급식 지원 완료 보고',
  summary: {
    text: '약정 목적에 맞게 집행했습니다.',
    evidenceIds: [`pledge:${evidence.pledgeId}`],
  },
  planComparison: {
    text: '계획 범위에서 집행했습니다.',
    evidenceIds: [`plan:${evidence.plan.id}`],
  },
  items: [
    {
      planItemId: evidence.plan.items[0].id,
      title: '식재료',
      text: '식재료 구매가 등록됐습니다.',
      evidenceIds: [`plan-item:${evidence.plan.items[0].id}`],
    },
  ],
  outcomes: {
    text: '성과 정보는 확인이 필요합니다.',
    evidenceIds: [`plan:${evidence.plan.id}`],
  },
  nextSteps: {
    text: '향후 계획은 확인이 필요합니다.',
    evidenceIds: [`plan:${evidence.plan.id}`],
  },
};

function repository(): ReportRepository {
  return {
    listEligible: vi.fn(),
    list: vi.fn(),
    buildEvidence: vi.fn().mockResolvedValue(evidence),
    begin: vi.fn().mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      status: 'generating',
      evidence,
      leaseToken: '88888888-8888-4888-8888-888888888888',
      shouldGenerate: true,
    }),
    saveGeneration: vi.fn(),
    markGenerationFailed: vi.fn(),
    claimRetry: vi.fn(),
    getReview: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
  };
}

describe('createDonationReport', () => {
  it('saves only a schema-validated generated report', async () => {
    const target = repository();
    const result = await createDonationReport(
      {
        donationId: evidence.donationId,
        planId: evidence.plan.id,
        idempotencyKey: 'report-test-1234567890',
      },
      {
        repository: target,
        generator: vi.fn().mockResolvedValue({
          content,
          metadata: {
            provider: 'upstage',
            model: 'solar-pro3',
            apiVersion: 'v1',
            promptVersion: 1,
            processedAt: '2026-08-03T00:00:00.000Z',
          },
        }),
      },
    );
    expect(result.status).toBe('review_required');
    expect(target.saveGeneration).toHaveBeenCalledWith(
      result.reportId,
      expect.any(String),
      content,
      expect.objectContaining({ model: 'solar-pro3' }),
    );
  });

  it('records a failure when generated content invents numeric claims', async () => {
    const target = repository();
    await expect(
      createDonationReport(
        {
          donationId: evidence.donationId,
          planId: evidence.plan.id,
          idempotencyKey: 'report-test-1234567890',
        },
        {
          repository: target,
          generator: vi.fn().mockResolvedValue({
            content: {
              ...content,
              summary: {
                ...content.summary,
                text: '총 9999원을 집행했습니다.',
              },
            },
            metadata: {
              provider: 'upstage',
              model: 'solar-pro3',
              apiVersion: 'v1',
              promptVersion: 1,
              processedAt: '2026-08-03T00:00:00.000Z',
            },
          }),
        },
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'generation_failed',
        retryable: true,
      }),
    );
    expect(target.markGenerationFailed).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'invalid_response',
    );
    expect(target.saveGeneration).not.toHaveBeenCalled();
  });

  it('does not call the model again for an idempotent completed request', async () => {
    const target = repository();
    target.begin = vi.fn().mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      status: 'review_required',
      evidence,
      leaseToken: null,
      shouldGenerate: false,
    });
    const generator = vi.fn();
    await expect(
      createDonationReport(
        {
          donationId: evidence.donationId,
          planId: evidence.plan.id,
          idempotencyKey: 'report-test-1234567890',
        },
        { repository: target, generator },
      ),
    ).resolves.toMatchObject({ duplicate: true, status: 'review_required' });
    expect(generator).not.toHaveBeenCalled();
  });
});
