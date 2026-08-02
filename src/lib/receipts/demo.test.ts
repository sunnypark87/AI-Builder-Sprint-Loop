import { describe, expect, it } from 'vitest';

import { buildDemoReceipt } from './demo';

describe('demo receipt', () => {
  it('creates a deterministic receipt with an explicit demo disclaimer', () => {
    expect(
      buildDemoReceipt(
        {
          amount: 50000,
          donorName: '홍길동',
          pledgeDate: '2026-08-01',
          pledgeId: 'pledge-1',
          recipientAddress: '부산시 해운대구',
          recipientName: '홍길동',
        },
        '2026-08-02T00:00:00.000Z',
      ),
    ).toEqual({
      amount: 50000,
      disclaimer: '데모 발급본이며 실제 세무·기부금 영수증의 효력이 없습니다.',
      donorName: '홍길동',
      issuedAt: '2026-08-02T00:00:00.000Z',
      pledgeDate: '2026-08-01',
      pledgeId: 'pledge-1',
      receiptNumber: 'DEMO-pledge-1',
      recipientAddress: '부산시 해운대구',
      recipientName: '홍길동',
    });
  });
});
