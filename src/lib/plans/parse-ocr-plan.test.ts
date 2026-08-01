import { describe, expect, it } from 'vitest';

import { parseOcrPlan } from '@/lib/plans/parse-ocr-plan';
import type { DocumentOcrResult } from '@/lib/upstage/document-ocr';

const validOcr: DocumentOcrResult = {
  apiVersion: '1.1',
  modelVersion: 'ocr-test',
  pages: [
    {
      page: 1,
      confidence: 0.98,
      text: [
        '계획명: 2026년 8월 교육 프로그램',
        '집행 기간: 2026. 08. 01. ~ 2026. 08. 31.',
        '교육 강사비 | 8월 수업 | 1,200,000원',
        '교재 및 준비물 600,000원',
        '총 계획 예산 1,800,000원',
      ].join('\n'),
    },
  ],
};

describe('parseOcrPlan', () => {
  it('extracts supported plan fields and keeps source evidence', () => {
    const result = parseOcrPlan(validOcr, '2026-07-31T00:00:00.000Z');

    expect(result.draft).toMatchObject({
      title: '2026년 8월 교육 프로그램',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      totalAmount: 1_800_000,
      items: [
        {
          name: '교육 강사비',
          description: '8월 수업',
          amount: 1_200_000,
          confidence: 0.98,
        },
        {
          name: '교재 및 준비물',
          amount: 600_000,
        },
      ],
    });
    expect(result.issues).toEqual([]);
    expect(result.metadata).toEqual({
      provider: 'upstage',
      apiVersion: '1.1',
      modelVersion: 'ocr-test',
      processedAt: '2026-07-31T00:00:00.000Z',
      pageCount: 1,
    });
  });

  it('does not invent missing values and reports review issues', () => {
    const result = parseOcrPlan({
      ...validOcr,
      pages: [
        {
          page: 1,
          confidence: 0.5,
          text: '<script>alert(1)</script>\n운영비 6O,OOO원',
        },
      ],
    });

    expect(result.draft).toMatchObject({
      title: '',
      periodStart: '',
      periodEnd: '',
      totalAmount: null,
      items: [
        {
          name: '운영비',
          amount: 60_000,
          sourceText: '운영비 6O,OOO원',
        },
      ],
    });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'title_required',
      'period_start_required',
      'period_end_required',
      'total_amount_required',
    ]);
  });

  it('flags a total that differs from the item sum', () => {
    const result = parseOcrPlan({
      ...validOcr,
      pages: [
        {
          ...validOcr.pages[0],
          text: validOcr.pages[0].text.replace('1,800,000원', '2,000,000원'),
        },
      ],
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'total_amount_mismatch' }),
    );
  });
});
