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

  it('keeps unrelated patch fields when a condition lacks approved grounding', () => {
    const result = normalizeConsultationResult({
      currentPledge: {},
      organization: {
        ...organization,
        programs: [
          {
            id: 'program-1',
            key: 'education',
            name: '아동 교육',
            description: '교육 지원',
            allowedConditions: ['교재비 지원'],
          },
        ],
      },
      modelOutput: {
        assistantMessage: '조건을 확인해 주세요.',
        proposedPatch: {
          donationDesignation: 'designated',
          donationCondition: '해외 의료비 지원',
        },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        proposedPatch: { donationDesignation: 'designated' },
        missingFields: expect.arrayContaining(['donationCondition']),
        groundingWarnings: [
          '지정 기부 조건은 승인된 기부처 사업이나 허용 조건에서 선택해 주세요.',
        ],
      },
    });
  });

  it('accepts conditions grounded in an approved program or condition', () => {
    const result = normalizeConsultationResult({
      currentPledge: {},
      organization: {
        ...organization,
        programs: [
          {
            id: 'program-1',
            key: 'education',
            name: '아동 교육',
            description: '교육 지원',
            allowedConditions: ['교재비 지원'],
          },
        ],
      },
      modelOutput: {
        assistantMessage: '조건을 확인해 주세요.',
        proposedPatch: {
          donationDesignation: 'designated',
          donationCondition: '아동 교육 사업의 교재비 지원',
        },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      value: { proposedPatch: { donationCondition: '교재비 지원' } },
    });
  });

  it('grounds a condition against the effective designation across turns', () => {
    const result = normalizeConsultationResult({
      currentPledge: {
        donationDesignation: 'designated',
      },
      organization: {
        ...organization,
        programs: [
          {
            id: 'program-1',
            key: 'education',
            name: '아동 교육',
            description: '교육 지원',
            allowedConditions: ['교재비 지원'],
          },
        ],
      },
      modelOutput: {
        assistantMessage: '조건을 확인해 주세요.',
        proposedPatch: { donationCondition: '해외 의료비 지원' },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        proposedPatch: {},
        missingFields: expect.arrayContaining(['donationCondition']),
        groundingWarnings: [
          '지정 기부 조건은 승인된 기부처 사업이나 허용 조건에서 선택해 주세요.',
        ],
      },
    });
  });

  it('does not ground a condition while the effective designation is undesignated', () => {
    const result = normalizeConsultationResult({
      currentPledge: { donationDesignation: 'undesignated' },
      organization: {
        ...organization,
        programs: [
          {
            id: 'program-1',
            key: 'education',
            name: '아동 교육',
            description: '교육 지원',
            allowedConditions: ['교재비 지원'],
          },
        ],
      },
      modelOutput: {
        assistantMessage: '조건을 확인해 주세요.',
        proposedPatch: { donationCondition: '교재비 지원' },
      },
    });
    expect(result).toMatchObject({
      ok: true,
      value: { proposedPatch: {}, groundingWarnings: expect.any(Array) },
    });
  });
});
