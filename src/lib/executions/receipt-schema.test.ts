import { describe, expect, it } from 'vitest';

import {
  mergeReceiptOcrProvenance,
  parseEditableReceiptDraft,
  parseReceiptDraft,
  validateReceiptDraft,
} from '@/lib/executions/receipt-schema';
import type { ReceiptDraft } from '@/lib/executions/types';

const validDraft: ReceiptDraft = {
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

describe('receipt schema', () => {
  it('parses and accepts a valid receipt draft', () => {
    expect(parseReceiptDraft(validDraft)).toEqual(validDraft);
    expect(validateReceiptDraft(validDraft)).toEqual([]);
  });

  it('rejects missing required fields and invalid amounts', () => {
    const issues = validateReceiptDraft({
      ...validDraft,
      merchantName: '',
      transactionAt: 'not-a-date',
      totalAmount: -1,
      items: [{ ...validDraft.items[0], quantity: 0, amount: null }],
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'merchant_required',
        'transaction_at_invalid',
        'total_required',
        'item_quantity_invalid',
        'item_amount_invalid',
      ]),
    );
  });

  it('rejects malformed runtime input', () => {
    expect(
      parseReceiptDraft({ ...validDraft, totalAmount: '2000' }),
    ).toBeNull();
  });

  it('rejects ambiguous timestamps and DB-constrained text lengths', () => {
    const issues = validateReceiptDraft({
      ...validDraft,
      transactionAt: '2026-08-02T14:30:00Z',
      paymentMethod: '가'.repeat(101),
      approvalNumber: '1'.repeat(41),
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'transaction_at_invalid',
        'payment_method_too_long',
        'approval_number_too_long',
      ]),
    );
  });

  it('rejects a calendar date that does not exist', () => {
    const issues = validateReceiptDraft({
      ...validDraft,
      transactionAt: '2026-02-30T10:00',
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'transaction_at_invalid',
        path: 'transactionAt',
      }),
    );
  });

  it('ignores client-provided OCR provenance and restores server evidence', () => {
    const edited = parseEditableReceiptDraft({
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
    });

    expect(edited).not.toBeNull();
    expect(mergeReceiptOcrProvenance(edited!, validDraft)).toEqual({
      ...validDraft,
      merchantName: '수정마트',
      items: [
        {
          ...validDraft.items[0],
          name: '수정 생수',
        },
      ],
    });
  });

  it('rejects a client-controlled OCR item identity change', () => {
    const edited = parseEditableReceiptDraft({
      ...validDraft,
      items: [{ ...validDraft.items[0], id: 'fabricated-item' }],
    });

    expect(edited).not.toBeNull();
    expect(mergeReceiptOcrProvenance(edited!, validDraft)).toBeNull();
  });
});
