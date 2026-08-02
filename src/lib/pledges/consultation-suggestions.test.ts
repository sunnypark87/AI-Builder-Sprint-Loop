import { describe, expect, it } from 'vitest';

import { getSuggestedReplies } from './consultation-suggestions';

describe('consultation suggestions', () => {
  it('changes replies for each next pledge field', () => {
    const amount = getSuggestedReplies('amount').map((reply) => reply.message);
    const designation = getSuggestedReplies('donationDesignation').map(
      (reply) => reply.message,
    );
    const payment = getSuggestedReplies('paymentMethod').map(
      (reply) => reply.message,
    );

    expect(amount).not.toEqual(designation);
    expect(designation).not.toEqual(payment);
    expect(payment).toContain('온라인으로 납부할게요');
  });
});
