import { describe, expect, it } from 'vitest';

import {
  toOrganizationAiContext,
  toPledgeAiContext,
} from './consultation-context';

describe('AI context allowlists', () => {
  it('drops private pledge fields', () => {
    expect(
      toPledgeAiContext({
        amount: 100000,
        donor_email: 'private@example.com',
        donor_identity_number_ciphertext: 'secret',
      }),
    ).toEqual({ amount: 100000 });
  });

  it('preserves the selected organization id as server context', () => {
    expect(
      toPledgeAiContext({
        organization_id: 'org-1',
      }),
    ).toEqual({ organizationId: 'org-1' });
  });

  it('normalizes stored database pledge columns before building context', () => {
    expect(
      toPledgeAiContext({
        amount: 250000,
        donation_designation: 'designated',
        donation_condition: '아동 교육 지원',
        payment_schedule: 'other',
        payment_schedule_other: '매월',
        payment_method: 'online',
        payment_method_other: '계좌이체',
      }),
    ).toEqual({
      amount: 250000,
      donationDesignation: 'designated',
      donationCondition: '아동 교육 지원',
      paymentSchedule: 'other',
      paymentScheduleOther: '매월',
      paymentMethod: 'online',
      paymentMethodOther: '계좌이체',
    });
  });

  it('normalizes only public organization fields', () => {
    expect(
      toOrganizationAiContext({
        id: 'org-1',
        name: '해봄',
        description: null,
        activityAreas: ['교육'],
        supportedPrograms: [],
        donationPolicy: null,
        private_note: '숨김',
      }),
    ).toEqual({
      id: 'org-1',
      name: '해봄',
      description: null,
      activityAreas: ['교육'],
      supportedPrograms: [],
      donationPolicy: null,
    });
  });
});
