import { describe, expect, it } from 'vitest';

import { buildReportEvidence } from './report-evidence';
import { parseAndValidateReportContent } from './report-schema';

const evidence = buildReportEvidence({
  organizationId: '11111111-1111-4111-8111-111111111111',
  donationId: '22222222-2222-4222-8222-222222222222',
  pledgeId: '33333333-3333-4333-8333-333333333333',
  purpose: '급식 지원',
  donationCondition: '보고 필요',
  plan: {
    id: '44444444-4444-4444-8444-444444444444',
    title: '급식 계획',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    totalAmount: 3000,
    items: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: '식재료',
        description: '',
        amount: 3000,
      },
    ],
  },
  executions: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      planItemId: '55555555-5555-4555-8555-555555555555',
      merchantName: '상점',
      transactionDate: '2026-07-10',
      totalAmount: 2000,
    },
  ],
});

const valid = () => ({
  version: 1,
  title: '급식 지원 완료 보고',
  summary: {
    text: '약정 목적에 맞춰 식재료를 구매했습니다.',
    evidenceIds: [`pledge:${evidence.pledgeId}`],
  },
  planComparison: {
    text: '등록된 계획 범위 안에서 집행했습니다.',
    evidenceIds: [`plan:${evidence.plan.id}`],
  },
  items: [
    {
      planItemId: evidence.plan.items[0].id,
      title: '식재료',
      text: '식재료 구매 내역이 등록됐습니다.',
      evidenceIds: [
        `plan-item:${evidence.plan.items[0].id}`,
        `execution:${evidence.executions[0].id}`,
      ],
    },
  ],
  outcomes: {
    text: '성과 정보는 담당자 확인이 필요합니다.',
    evidenceIds: [`plan:${evidence.plan.id}`],
  },
  nextSteps: {
    text: '향후 계획 정보는 아직 확인되지 않았습니다.',
    evidenceIds: [`plan:${evidence.plan.id}`],
  },
});

describe('report schema', () => {
  it('accepts cited narrative without numeric claims', () => {
    expect(parseAndValidateReportContent(valid(), evidence).issues).toEqual([]);
  });

  it('blocks numeric claims and unknown evidence', () => {
    const content = valid();
    content.summary.text = '총 9999원을 집행했습니다.';
    content.summary.evidenceIds = ['execution:unknown'];
    const result = parseAndValidateReportContent(content, evidence);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['numeric_claim_not_allowed', 'unknown_evidence']),
    );
  });

  it('blocks HTML and missing plan items', () => {
    const content = valid();
    content.outcomes.text = '<script>leak</script>';
    content.items = [];
    const result = parseAndValidateReportContent(content, evidence);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['html_not_allowed', 'item_mismatch']),
    );
  });
});
