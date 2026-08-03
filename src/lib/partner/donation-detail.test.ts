import { describe, expect, it } from 'vitest';

import { getDonationMilestones, getDonationProgress } from './donation-detail';

const completeInput = {
  pledgeStatus: 'signed',
  paymentStatus: 'completed',
  plans: [{ status: 'registered' }],
  executions: [{ status: 'registered' }],
  reports: [{ status: 'published' }],
};

describe('donation detail progress', () => {
  it('opens the next required action in order', () => {
    expect(
      getDonationProgress({
        ...completeInput,
        plans: [],
      }),
    ).toMatchObject({ key: 'plan', nextActionKind: 'plan' });

    expect(
      getDonationProgress({
        ...completeInput,
        executions: [],
      }),
    ).toMatchObject({ key: 'executing', nextActionKind: 'execution' });
  });

  it('does not mark a donation complete before a published report', () => {
    expect(
      getDonationProgress({
        ...completeInput,
        reports: [{ status: 'review_required' }],
      }),
    ).toMatchObject({ key: 'report', nextActionKind: 'report' });
  });

  it('marks all milestones complete only after the report is published', () => {
    expect(
      getDonationMilestones(completeInput).every(
        (item) => item.state === 'complete',
      ),
    ).toBe(true);
  });
});
