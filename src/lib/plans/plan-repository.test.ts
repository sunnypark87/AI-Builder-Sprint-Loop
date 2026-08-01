import { describe, expect, it } from 'vitest';

import { getPlanRecoveryState } from '@/lib/plans/plan-repository';

describe('getPlanRecoveryState', () => {
  const now = new Date('2026-08-01T00:02:00.000Z').getTime();

  it('does not offer recovery while an analysis lease is active', () => {
    expect(
      getPlanRecoveryState(
        'analyzing',
        'organization/plan/source.pdf',
        '2026-08-01T00:03:00.000Z',
        now,
      ),
    ).toEqual({ canRetry: false, needsReupload: false });
  });

  it('offers retry for an expired analysis with a stored source', () => {
    expect(
      getPlanRecoveryState(
        'analyzing',
        'organization/plan/source.pdf',
        '2026-08-01T00:01:00.000Z',
        now,
      ),
    ).toEqual({ canRetry: true, needsReupload: false });
  });

  it('requires reupload for a failed plan without a stored source', () => {
    expect(getPlanRecoveryState('analysis_failed', null, null, now)).toEqual({
      canRetry: false,
      needsReupload: true,
    });
  });

  it('offers retry for a failed plan with a stored source', () => {
    expect(
      getPlanRecoveryState(
        'analysis_failed',
        'organization/plan/source.pdf',
        null,
        now,
      ),
    ).toEqual({ canRetry: true, needsReupload: false });
  });
});
