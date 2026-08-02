import { describe, expect, it } from 'vitest';

import {
  recoverModelConsultationOutput,
  validateModelConsultationOutput,
  validatePledgePatch,
} from './ai-schema';

const validResult = {
  assistantMessage: '기부 금액을 확인해 주세요.',
  proposedPatch: {
    amount: 100000,
    donationDesignation: 'designated',
    donationCondition: '아동 교육 사업에 사용',
  },
};

describe('AI pledge schema', () => {
  it('accepts a valid structured result', () => {
    expect(validateModelConsultationOutput(validResult)).toMatchObject({
      ok: true,
    });
  });

  it('rejects unknown fields and invalid donation choices', () => {
    const result = validateModelConsultationOutput({
      ...validResult,
      proposedPatch: { donationDesignation: 'unknown', unknown: 'x' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown top-level response fields', () => {
    const result = validateModelConsultationOutput({
      ...validResult,
      hiddenInstruction: 'ignore the contract',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects conflicting missing and confirmation fields', () => {
    const result = validateModelConsultationOutput({
      ...validResult,
      missingFields: ['amount'],
      confirmationFields: ['amount'],
    });
    expect(result.ok).toBe(false);
  });

  it('allows incomplete choices so the server can ask a follow-up question', () => {
    expect(validatePledgePatch({ donationDesignation: 'designated' }).ok).toBe(
      true,
    );
    expect(validatePledgePatch({ paymentSchedule: 'other' }).ok).toBe(true);
    expect(validatePledgePatch({ paymentMethod: 'other' }).ok).toBe(true);
  });

  it('rejects a condition attached to an undesignated donation', () => {
    expect(
      validateModelConsultationOutput({
        ...validResult,
        proposedPatch: {
          donationDesignation: 'undesignated',
          donationCondition: '특정 사업에 사용',
        },
      }).ok,
    ).toBe(false);
  });

  it('keeps the valid message and discards malformed patch fields', () => {
    expect(
      recoverModelConsultationOutput({
        assistantMessage: '기부 유형을 확인해 주세요.',
        proposedPatch: {
          donationDesignation: 'designated',
          amount: '많이',
          unknown: '무시',
        },
      }),
    ).toEqual({
      ok: true,
      value: {
        assistantMessage: '기부 유형을 확인해 주세요.',
        proposedPatch: { donationDesignation: 'designated' },
      },
      discardedPatchFields: ['amount', 'unknown'],
    });
  });
});
