import { describe, expect, it } from 'vitest';

import { PATCH } from '@/app/api/partner/executions/[executionId]/route';

const executionId = '11111111-1111-4111-8111-111111111111';
const validDraft = {
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

describe('PATCH /api/partner/executions/[executionId]', () => {
  it.each([
    ['paymentMethod', '카'.repeat(101), 'payment_method_too_long'],
    ['approvalNumber', '1'.repeat(41), 'approval_number_too_long'],
  ])(
    'returns 422 before persistence when %s exceeds its DB limit',
    async (field, value, issueCode) => {
      const response = await PATCH(
        new Request(`http://localhost/api/partner/executions/${executionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draft: { ...validDraft, [field]: value },
            warningReason: '',
          }),
        }),
        { params: Promise.resolve({ executionId }) },
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'validation_failed', retryable: false },
        issues: [{ code: issueCode, path: field }],
      });
    },
  );

  it('returns 422 before persistence for a nonexistent transaction date', async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/partner/executions/${executionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: { ...validDraft, transactionAt: '2026-02-30T10:00' },
          warningReason: '',
        }),
      }),
      { params: Promise.resolve({ executionId }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_failed', retryable: false },
      issues: [{ code: 'transaction_at_invalid', path: 'transactionAt' }],
    });
  });
});
