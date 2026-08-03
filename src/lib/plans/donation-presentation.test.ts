import { describe, expect, it } from 'vitest';

import { formatEligibleDonationLabel } from './donation-presentation';

describe('formatEligibleDonationLabel', () => {
  it('shows donor, purpose, amount, and pledge date for a linked donation', () => {
    expect(
      formatEligibleDonationLabel({
        amount: 100000,
        createdAt: '2026-08-03T00:00:00Z',
        donorName: '박재선',
        id: '652a8a67-0000-4000-8000-000000000000',
        pledgeDate: '2026-08-03',
        purpose: '돌봄 아동 교육 지원',
      }),
    ).toBe('박재선 님 · 돌봄 아동 교육 지원 · 100,000원 · 2026. 8. 3.');
  });

  it('keeps the short id only as fallback metadata for a legacy donation', () => {
    expect(
      formatEligibleDonationLabel({
        amount: 50000,
        createdAt: '2026-08-02T00:00:00+09:00',
        id: '652a8a67-0000-4000-8000-000000000000',
      }),
    ).toBe('기존 기부 · 50,000원 · 2026. 8. 2. (652a8a67)');
  });
});
