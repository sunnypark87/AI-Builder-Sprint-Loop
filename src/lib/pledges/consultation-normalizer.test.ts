import { describe, expect, it } from 'vitest';

import { normalizeConsultationResult } from './consultation-normalizer';

const organization = {
  id: 'org-1',
  name: '해봄',
  description: null,
  activityAreas: ['교육'],
  supportedPrograms: [],
  donationPolicy: null,
};

describe('consultation result normalization', () => {
  it('derives missing and confirmation fields on the server', () => {
    const result = normalizeConsultationResult({
      currentPledge: { organizationId: 'org-1' },
      organization,
      modelOutput: {
        assistantMessage: '확인해 주세요.',
        proposedPatch: { amount: 100000, donationDesignation: 'designated' },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        missingFields: [
          'donationCondition',
          'paymentSchedule',
          'paymentMethod',
        ],
        confirmationFields: ['amount', 'donationDesignation'],
      },
    });
  });

  it('clears stale conditional values when a choice changes', () => {
    const result = normalizeConsultationResult({
      currentPledge: {
        organizationId: 'org-1',
        donationDesignation: 'designated',
        donationCondition: '교육',
      },
      organization,
      modelOutput: {
        assistantMessage: '변경했어요.',
        proposedPatch: {
          donationDesignation: 'undesignated',
          paymentSchedule: 'lump_sum',
          paymentMethod: 'online',
        },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        proposedPatch: {
          donationCondition: null,
          paymentScheduleOther: null,
          paymentMethodOther: null,
        },
      },
    });
  });

  it('keeps the conversation result independent from impact summaries', () => {
    const result = normalizeConsultationResult({
      currentPledge: {},
      organization,
      modelOutput: {
        assistantMessage: '기부 조건을 확인해 주세요.',
        proposedPatch: {},
      },
    });
    expect(result).toMatchObject({
      ok: true,
      value: { assistantMessage: '기부 조건을 확인해 주세요.' },
    });
  });
});
