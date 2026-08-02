import { describe, expect, it } from 'vitest';

import { canTransitionPayment } from './status';

describe('demo payment state transitions', () => {
  it('allows each terminal outcome from pending', () => {
    expect(canTransitionPayment('pending', 'completed')).toBe(true);
    expect(canTransitionPayment('pending', 'failed')).toBe(true);
    expect(canTransitionPayment('pending', 'cancelled')).toBe(true);
  });

  it('does not allow terminal payment states to be changed', () => {
    expect(canTransitionPayment('completed', 'pending')).toBe(false);
    expect(canTransitionPayment('failed', 'completed')).toBe(false);
    expect(canTransitionPayment('cancelled', 'completed')).toBe(false);
  });
});
