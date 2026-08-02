import { describe, expect, it } from 'vitest';

import {
  findPledgeConflicts,
  getMissingPledgeFields,
  selectNextQuestion,
} from './consultation';

describe('pledge consultation rules', () => {
  it('finds required pledge agreement fields', () => {
    expect(getMissingPledgeFields({ organizationId: 'org-1' })).toEqual([
      'amount',
      'donationDesignation',
      'paymentSchedule',
      'paymentMethod',
    ]);
  });

  it('never asks the donor to provide the already selected organization', () => {
    expect(getMissingPledgeFields({})).not.toContain('organization');
  });

  it('requires a condition only for designated donations', () => {
    expect(
      getMissingPledgeFields({
        organizationId: 'org-1',
        amount: 100000,
        donationDesignation: 'designated',
        paymentSchedule: 'lump_sum',
        paymentMethod: 'online',
      }),
    ).toContain('donationCondition');
    expect(
      getMissingPledgeFields({
        organizationId: 'org-1',
        amount: 100000,
        donationDesignation: 'undesignated',
        paymentSchedule: 'lump_sum',
        paymentMethod: 'online',
      }),
    ).not.toContain('donationCondition');
  });

  it('does not silently overwrite a confirmed value', () => {
    expect(findPledgeConflicts({ amount: 100000 }, { amount: 200000 })).toEqual(
      ['amount'],
    );
  });

  it('prioritizes conflicts before missing fields', () => {
    expect(selectNextQuestion(['donationCondition'], ['amount'])).toBe(
      'amount',
    );
  });
});
