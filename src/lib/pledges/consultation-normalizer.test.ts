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
      latestUserMessage: '10만원을 지정 기부로 할게요.',
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
      latestUserMessage: '비지정 기부로 바꾸고 한 번에 온라인 납부할게요.',
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
      latestUserMessage: '추천해 주세요.',
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
      latestUserMessage: '지정 기부로 해외 의료비 지원에 사용해 주세요.',
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
      latestUserMessage:
        '지정 기부로 아동 교육 사업의 교재비 지원에 사용해 주세요.',
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
      latestUserMessage: '해외 의료비 지원에 사용해 주세요.',
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
      latestUserMessage: '교재비 지원에 사용해 주세요.',
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

  it('applies only amount when the latest donor message mentions only amount', () => {
    const result = normalizeConsultationResult({
      currentPledge: { organizationId: 'org-1' },
      latestUserMessage: '10만원 기부할게요.',
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
        assistantMessage: '확인했어요.',
        proposedPatch: {
          amount: 100000,
          donationDesignation: 'designated',
          donationCondition: '교재비 지원',
          paymentMethod: 'online',
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        proposedPatch: { amount: 100000 },
        confirmationFields: ['amount'],
        nextQuestionField: 'donationDesignation',
      },
    });
  });

  it('recovers an explicit Korean amount even when the model omits it', () => {
    const result = normalizeConsultationResult({
      currentPledge: { organizationId: 'org-1' },
      latestUserMessage: '10만원을 기부할게요.',
      organization,
      modelOutput: {
        assistantMessage: '확인했어요.',
        proposedPatch: {},
      },
    });

    expect(result).toMatchObject({
      ok: true,
      value: { proposedPatch: { amount: 100000 } },
    });
  });

  it('does not infer a detailed condition from a program name alone', () => {
    const result = normalizeConsultationResult({
      currentPledge: {
        organizationId: 'org-1',
        donationDesignation: 'designated',
      },
      latestUserMessage: '아동 교육 사업에 기부할게요.',
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
        assistantMessage: '확인했어요.',
        proposedPatch: { donationCondition: '교재비 지원' },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        proposedPatch: {},
        missingFields: expect.arrayContaining(['donationCondition']),
      },
    });
  });

  it('asks for donation designation when the donor chooses to decide the type first', () => {
    const result = normalizeConsultationResult({
      currentPledge: { organizationId: 'org-1' },
      latestUserMessage: '기부 유형부터 정할게요.',
      organization,
      modelOutput: {
        assistantMessage: '기부 유형부터 확인할게요.',
        proposedPatch: {},
      },
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        proposedPatch: {},
        nextQuestionField: 'donationDesignation',
      },
    });
  });
});
