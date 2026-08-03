import { describe, expect, it } from 'vitest';

import { buildReportEvidence, ReportEvidenceError } from './report-evidence';

const source = () => ({
  organizationId: '11111111-1111-4111-8111-111111111111',
  donationId: '22222222-2222-4222-8222-222222222222',
  pledgeId: '33333333-3333-4333-8333-333333333333',
  purpose: '아동 급식 지원',
  donationCondition: '집행 완료 후 보고',
  plan: {
    id: '44444444-4444-4444-8444-444444444444',
    title: '급식 지원 계획',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    totalAmount: 3000,
    items: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: '식재료',
        description: '식재료 구매',
        amount: 3000,
        businessNumber: 'sensitive',
      },
    ],
  },
  executions: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      planItemId: '55555555-5555-4555-8555-555555555555',
      merchantName: '안전상점',
      transactionDate: '2026-07-10',
      totalAmount: 2400,
      approvalNumber: 'private',
      sourcePath: 'private/source.jpg',
    },
  ],
});

describe('buildReportEvidence', () => {
  it('calculates deterministic totals and allowlists public fields', () => {
    const evidence = buildReportEvidence(source());
    expect(evidence.plan).toMatchObject({
      totalAmount: 3000,
      spentAmount: 2400,
      remainingAmount: 600,
      executionCount: 1,
    });
    expect(JSON.stringify(evidence)).not.toContain('businessNumber');
    expect(JSON.stringify(evidence)).not.toContain('approvalNumber');
    expect(JSON.stringify(evidence)).not.toContain('sourcePath');
  });

  it('rejects executions outside the registered plan period', () => {
    const invalid = source();
    invalid.executions[0].transactionDate = '2026-08-01';
    expect(() => buildReportEvidence(invalid)).toThrowError(
      new ReportEvidenceError(
        'execution_outside_period',
        '계획 기간 밖의 집행 내역이 포함되어 있습니다.',
      ),
    );
  });

  it('rejects plan and item total mismatches', () => {
    const invalid = source();
    invalid.plan.totalAmount = 4000;
    expect(() => buildReportEvidence(invalid)).toThrowError(/계획 항목 합계/);
  });
});
