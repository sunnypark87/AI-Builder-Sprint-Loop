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
