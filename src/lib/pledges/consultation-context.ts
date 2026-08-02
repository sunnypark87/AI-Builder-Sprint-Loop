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
  if (typeof organizationId === 'string')
    context.organizationId = organizationId;
  if (typeof input.amount === 'number') context.amount = input.amount;
  if (isDesignation(input.donationDesignation))
    context.donationDesignation = input.donationDesignation;
  if (typeof input.donationCondition === 'string')
    context.donationCondition = input.donationCondition;
  if (isSchedule(input.paymentSchedule))
    context.paymentSchedule = input.paymentSchedule;
  if (typeof input.paymentScheduleOther === 'string')
    context.paymentScheduleOther = input.paymentScheduleOther;
  if (isMethod(input.paymentMethod))
    context.paymentMethod = input.paymentMethod;
  if (typeof input.paymentMethodOther === 'string')
    context.paymentMethodOther = input.paymentMethodOther;
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
