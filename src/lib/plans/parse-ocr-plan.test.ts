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

  it('restores fields when PDF OCR joins the plan into one line', () => {
    const result = parseOcrPlan({
      ...validOcr,
      pages: [
        {
          page: 1,
          confidence: 0.98,
          text: [
            '계획명: 8월 급식 계획',
            '집행 기간: 2026-08-01 ~ 2026-08-31',
            '식재료 | 급식 재료 구입 200,000원',
            '총 계획 예산: 200,000원',
          ].join(' '),
        },
      ],
    });

    expect(result.draft).toEqual({
      title: '8월 급식 계획',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      totalAmount: 200_000,
      items: [
        {
          id: 'ocr-item-4',
          name: '식재료',
          description: '급식 재료 구입',
          amount: 200_000,
          confidence: 0.98,
          sourceText: '식재료 | 급식 재료 구입 200,000원',
          sourceName: '식재료',
          sourceAmount: 200_000,
        },
      ],
    });
    expect(result.issues).toEqual([]);
  });

  it('separates multiple pipe-delimited items from flattened PDF OCR', () => {
    const result = parseOcrPlan({
      ...validOcr,
      pages: [
        {
          page: 1,
          confidence: 0.98,
          text: [
            '기부금 집행 계획서',
            '계획명: 2026년 8월 아동 급식 지원 계획',
            '집행 기간: 2026-08-01 ~ 2026-08-31',
            '급식 식재료 | 쌀, 채소, 과일 및 단백질 식재료 구매 | 1,500,000원',
            '도시락 용기 | 친환경 도시락 용기 및 포장재 구매 | 900,000원',
            '급식 배송비 | 지원 가정 대상 도시락 배송 | 600,000원',
            '총 계획 예산: 3,000,000원',
          ].join(' '),
        },
      ],
    });

    expect(result.draft).toMatchObject({
      title: '2026년 8월 아동 급식 지원 계획',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      totalAmount: 3_000_000,
      items: [
        {
          name: '급식 식재료',
          description: '쌀, 채소, 과일 및 단백질 식재료 구매',
          amount: 1_500_000,
        },
        {
          name: '도시락 용기',
          description: '친환경 도시락 용기 및 포장재 구매',
          amount: 900_000,
        },
        {
          name: '급식 배송비',
          description: '지원 가정 대상 도시락 배송',
          amount: 600_000,
        },
      ],
    });
    expect(result.issues).toEqual([]);
  });

  it('maps labeled item names and descriptions from flattened PDF OCR', () => {
    const result = parseOcrPlan({
      ...validOcr,
      pages: [
        {
          page: 1,
          confidence: 0.98,
          text: [
            '계획명: 2026년 8월 아동 급식 지원 계획',
            '집행 기간: 2026-08-01 ~ 2026-08-31',
            '항목명: 급식 식재료 사용 목적: 쌀, 채소, 과일 및 단백질 식재료 구매 계획 금액: 1,500,000원',
            '항목명: 도시락 용기 사용 목적: 친환경 도시락 용기 및 포장재 구매 계획 금액: 900,000원',
            '항목명: 급식 배송비 사용 목적: 지원 가정 대상 도시락 배송 계획 금액: 600,000원',
            '총 계획 예산: 3,000,000원',
          ].join(' '),
        },
      ],
    });

    expect(result.draft.items).toMatchObject([
      {
        name: '급식 식재료',
        description: '쌀, 채소, 과일 및 단백질 식재료 구매',
        amount: 1_500_000,
      },
      {
        name: '도시락 용기',
        description: '친환경 도시락 용기 및 포장재 구매',
        amount: 900_000,
      },
      {
        name: '급식 배송비',
        description: '지원 가정 대상 도시락 배송',
        amount: 600_000,
      },
    ]);
    expect(result.issues).toEqual([]);
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
