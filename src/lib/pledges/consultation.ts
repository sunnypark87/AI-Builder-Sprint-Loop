import type { AiPledgePatch, PledgeField } from './ai-schema';

export type ConsultationPledgeState = {
  organizationId?: string;
  amount?: number;
  donationDesignation?: 'designated' | 'undesignated';
  donationCondition?: string | null;
  paymentSchedule?: 'lump_sum' | 'other';
  paymentScheduleOther?: string | null;
  paymentMethod?: 'online' | 'direct' | 'other';
  paymentMethodOther?: string | null;
};

export function getMissingPledgeFields(
  current: ConsultationPledgeState,
  proposed: AiPledgePatch = {},
): PledgeField[] {
  const value = { ...current, ...proposed };
  const missing: PledgeField[] = [];
  if (!value.amount || value.amount <= 0) missing.push('amount');
  if (!value.donationDesignation) missing.push('donationDesignation');
  if (
    value.donationDesignation === 'designated' &&
    !value.donationCondition?.trim()
  ) {
    missing.push('donationCondition');
  }
  if (!value.paymentSchedule) missing.push('paymentSchedule');
  if (
    value.paymentSchedule === 'other' &&
    !value.paymentScheduleOther?.trim()
  ) {
    missing.push('paymentScheduleOther');
  }
  if (!value.paymentMethod) missing.push('paymentMethod');
  if (value.paymentMethod === 'other' && !value.paymentMethodOther?.trim()) {
    missing.push('paymentMethodOther');
  }
  return missing;
}

export function findPledgeConflicts(
  current: ConsultationPledgeState,
  proposed: AiPledgePatch,
): PledgeField[] {
  const conflicts: PledgeField[] = [];
  for (const field of [
    'amount',
    'donationDesignation',
    'donationCondition',
    'paymentSchedule',
    'paymentScheduleOther',
    'paymentMethod',
    'paymentMethodOther',
  ] as const) {
    if (proposed[field] === undefined || current[field] === undefined) continue;
    if (proposed[field] !== current[field]) conflicts.push(field);
  }
  return conflicts;
}

export function selectNextQuestion(
  missingFields: PledgeField[],
  conflicts: PledgeField[] = [],
): PledgeField | null {
  return (
    [...conflicts, ...missingFields].find(
      (field, index, fields) => fields.indexOf(field) === index,
    ) ?? null
  );
}
