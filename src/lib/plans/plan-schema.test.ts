import { describe, expect, it } from 'vitest';

import { parsePlanDraft, validatePlanDraft } from '@/lib/plans/plan-schema';
import type { PlanDraft } from '@/lib/plans/types';

const validDraft: PlanDraft = {
  title: '2026년 교육 프로그램',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  totalAmount: 1_800_000,
  items: [
    {
      id: '1',
      name: '교육 강사비',
      description: '',
      amount: 1_200_000,
      confidence: 0.99,
      sourceText: '교육 강사비 1,200,000원',
      sourceName: '교육 강사비',
      sourceAmount: 1_200_000,
    },
    {
      id: '2',
      name: '교재비',
      description: '',
      amount: 600_000,
      confidence: 0.98,
      sourceText: '교재비 600,000원',
      sourceName: '교재비',
      sourceAmount: 600_000,
    },
  ],
};

describe('validatePlanDraft', () => {
  it('accepts a complete plan whose item sum matches its total', () => {
    expect(validatePlanDraft(validDraft)).toEqual([]);
  });

  it('rejects reversed dates and a mismatched total', () => {
    const issues = validatePlanDraft({
      ...validDraft,
      periodStart: '2026-09-01',
      periodEnd: '2026-08-31',
      totalAmount: 2_000_000,
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      'period_invalid',
      'total_amount_mismatch',
    ]);
  });

  it('rejects missing required fields and invalid item amounts', () => {
    const issues = validatePlanDraft({
      title: '',
      periodStart: '',
      periodEnd: '',
      totalAmount: null,
      items: [
        {
          ...validDraft.items[0],
          name: '',
          amount: -1,
        },
      ],
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      'title_required',
      'period_start_required',
      'period_end_required',
      'item_name_required',
      'item_amount_invalid',
      'total_amount_required',
    ]);
  });

  it('rejects duplicate item identifiers', () => {
    const issues = validatePlanDraft({
      ...validDraft,
      items: [validDraft.items[0], { ...validDraft.items[1], id: '1' }],
    });

    expect(issues).toContainEqual({
      code: 'item_id_duplicate',
      message: '중복된 예산 항목을 제거해 주세요.',
      path: 'items.1.name',
    });
  });

  it('rejects plan text and item counts beyond storage limits', () => {
    const issues = validatePlanDraft({
      ...validDraft,
      title: '가'.repeat(201),
      items: Array.from({ length: 101 }, (_, index) => ({
        ...validDraft.items[0],
        id: String(index),
        name: index === 0 ? '항'.repeat(201) : `항목 ${index}`,
        description: index === 0 ? '설'.repeat(1001) : '',
        amount: 1,
      })),
      totalAmount: 101,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'title_too_long',
        'items_too_many',
        'item_name_too_long',
        'item_description_too_long',
      ]),
    );
  });
});

describe('parsePlanDraft', () => {
  it('rejects a blank item identifier', () => {
    expect(
      parsePlanDraft({
        ...validDraft,
        items: [{ ...validDraft.items[0], id: ' ' }],
      }),
    ).toBeNull();
  });
});
