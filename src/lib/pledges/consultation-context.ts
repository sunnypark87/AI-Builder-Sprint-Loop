import type {
  AiPledgePatch,
  DonationDesignation,
  OrganizationAiContext,
  OrganizationAiProgram,
  PaymentMethod,
  PaymentSchedule,
} from './ai-schema';

export type PledgeAiContext = Partial<AiPledgePatch> & {
  organizationId?: string;
};

export function toPledgeAiContext(
  input: Record<string, unknown>,
): PledgeAiContext {
  const context: PledgeAiContext = {};
  const organizationId = input.organizationId ?? input.organization_id;
  const amount = input.amount;
  const donationDesignation =
    input.donationDesignation ?? input.donation_designation;
  const donationCondition = input.donationCondition ?? input.donation_condition;
  const paymentSchedule = input.paymentSchedule ?? input.payment_schedule;
  const paymentScheduleOther =
    input.paymentScheduleOther ?? input.payment_schedule_other;
  const paymentMethod = input.paymentMethod ?? input.payment_method;
  const paymentMethodOther =
    input.paymentMethodOther ?? input.payment_method_other;
  if (typeof organizationId === 'string')
    context.organizationId = organizationId;
  if (typeof amount === 'number') context.amount = amount;
  if (isDesignation(donationDesignation))
    context.donationDesignation = donationDesignation;
  if (typeof donationCondition === 'string')
    context.donationCondition = donationCondition;
  if (isSchedule(paymentSchedule)) context.paymentSchedule = paymentSchedule;
  if (typeof paymentScheduleOther === 'string')
    context.paymentScheduleOther = paymentScheduleOther;
  if (isMethod(paymentMethod)) context.paymentMethod = paymentMethod;
  if (typeof paymentMethodOther === 'string')
    context.paymentMethodOther = paymentMethodOther;
  return context;
}

export function toOrganizationAiContext(
  input: Record<string, unknown>,
): OrganizationAiContext | null {
  if (
    typeof input.id !== 'string' ||
    typeof input.name !== 'string' ||
    !Array.isArray(input.activityAreas) ||
    !Array.isArray(input.supportedPrograms) ||
    input.activityAreas.some((value) => typeof value !== 'string') ||
    input.supportedPrograms.some((value) => typeof value !== 'string')
  )
    return null;
  const programs = Array.isArray(input.programs)
    ? input.programs.filter(isOrganizationAiProgram)
    : undefined;
  return {
    id: input.id,
    name: input.name,
    description:
      typeof input.description === 'string' ? input.description : null,
    activityAreas: input.activityAreas,
    supportedPrograms: input.supportedPrograms,
    ...(programs?.length ? { programs } : {}),
    donationPolicy:
      typeof input.donationPolicy === 'string' ? input.donationPolicy : null,
  };
}

function isOrganizationAiProgram(
  value: unknown,
): value is OrganizationAiProgram {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.key === 'string' &&
    typeof record.name === 'string' &&
    typeof record.description === 'string' &&
    Array.isArray(record.allowedConditions) &&
    record.allowedConditions.every((condition) => typeof condition === 'string')
  );
}

function isDesignation(value: unknown): value is DonationDesignation {
  return value === 'designated' || value === 'undesignated';
}
function isSchedule(value: unknown): value is PaymentSchedule {
  return value === 'lump_sum' || value === 'other';
}
function isMethod(value: unknown): value is PaymentMethod {
  return value === 'online' || value === 'direct' || value === 'other';
}
