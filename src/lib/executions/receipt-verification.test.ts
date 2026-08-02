import { describe, expect, it } from 'vitest';

import {
  hasBlockedVerification,
  hasVerificationWarning,
  isValidBusinessNumber,
  verifyReceipt,
} from '@/lib/executions/receipt-verification';
import type {
  ReceiptDraft,
  ReceiptVerificationContext,
} from '@/lib/executions/types';

const draft: ReceiptDraft = {
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
      confidence: 0.95,
      sourceText: '품목: 생수',
      sourceName: '생수',
      sourceAmount: 2000,
    },
  ],
};

const context: ReceiptVerificationContext = {
  planPeriodStart: '2026-08-01',
  planPeriodEnd: '2026-08-31',
  donationPaidAt: '2026-07-31T10:00:00Z',
  remainingBudget: 10_000,
  duplicateSource: false,
  duplicateTransaction: false,
  sourceFingerprint: 'a'.repeat(64),
};

describe('receipt verification', () => {
  it('passes a consistent receipt while avoiding claims about real issuer status', () => {
    const results = verifyReceipt(draft, [], context);
    expect(hasBlockedVerification(results)).toBe(false);
    expect(hasVerificationWarning(results)).toBe(false);
    expect(
      results.find((item) => item.code === 'business_number_checksum')?.message,
    ).toContain('실제 사업자 상태를 뜻하지는 않습니다');
  });

  it('blocks arithmetic, period, budget and duplicate violations', () => {
    const results = verifyReceipt(
      { ...draft, taxAmount: 500, transactionAt: '2026-09-01T10:00' },
      [],
      {
        ...context,
        remainingBudget: 1000,
        duplicateSource: true,
        duplicateTransaction: true,
      },
    );
    expect(
      results
        .filter((item) => item.outcome === 'blocked')
        .map((item) => item.code),
    ).toEqual(
      expect.arrayContaining([
        'receipt_arithmetic',
        'plan_period',
        'remaining_budget',
        'duplicate_source',
        'duplicate_transaction',
      ]),
    );
  });

  it('warns instead of claiming verification when authoritative payment time is missing', () => {
    const results = verifyReceipt(draft, [], {
      ...context,
      donationPaidAt: null,
    });
    expect(hasVerificationWarning(results)).toBe(true);
    expect(
      results.find((item) => item.code === 'donation_paid_at')?.outcome,
    ).toBe('warning');
  });

  it('blocks a receipt earlier than payment on the same Korea-local date', () => {
    const results = verifyReceipt(draft, [], {
      ...context,
      donationPaidAt: '2026-08-02T06:00:00Z',
    });

    expect(
      results.find((item) => item.code === 'donation_paid_at'),
    ).toMatchObject({
      outcome: 'blocked',
      evidence: expect.stringContaining('+09:00'),
    });
  });

  it('requires manual review when an OCR item confidence is low', () => {
    const results = verifyReceipt(
      {
        ...draft,
        items: [{ ...draft.items[0], confidence: 0.79 }],
      },
      [],
      context,
    );
    expect(hasVerificationWarning(results)).toBe(true);
    expect(results.find((item) => item.code === 'ocr_review')).toMatchObject({
      outcome: 'warning',
      evidence: expect.stringContaining('1개'),
    });
  });

  it('validates Korean business number checksums deterministically', () => {
    expect(isValidBusinessNumber('1208155297')).toBe(true);
    expect(isValidBusinessNumber('1208155298')).toBe(false);
    expect(isValidBusinessNumber('123')).toBe(false);
  });
});
