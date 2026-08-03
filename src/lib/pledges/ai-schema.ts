export const PLEDGE_FIELDS = [
  'organization',
  'amount',
  'donationDesignation',
  'donationCondition',
  'paymentSchedule',
  'paymentScheduleOther',
  'paymentMethod',
  'paymentMethodOther',
] as const;

export type PledgeField = (typeof PLEDGE_FIELDS)[number];
export type DonationDesignation = 'designated' | 'undesignated';
export type PaymentSchedule = 'lump_sum' | 'other';
export type PaymentMethod = 'online' | 'direct' | 'other';

export type AiPledgePatch = {
  amount?: number;
  donationDesignation?: DonationDesignation;
  donationCondition?: string | null;
  paymentSchedule?: PaymentSchedule;
  paymentScheduleOther?: string | null;
  paymentMethod?: PaymentMethod;
  paymentMethodOther?: string | null;
};

export type OrganizationAiContext = {
  id: string;
  name: string;
  description: string | null;
  activityAreas: string[];
  supportedPrograms: string[];
  programs?: OrganizationAiProgram[];
  donationPolicy: string | null;
};

export type OrganizationAiProgram = {
  id: string;
  key: string;
  name: string;
  description: string;
  allowedConditions: string[];
};

export type ModelConsultationOutput = {
  assistantMessage: string;
  proposedPatch: AiPledgePatch;
};

export type PledgeConsultationResult = ModelConsultationOutput & {
  missingFields: PledgeField[];
  confirmationFields: PledgeField[];
  conflictFields: PledgeField[];
  nextQuestionField: PledgeField | null;
  groundingWarnings?: string[];
};

export type SchemaValidationError = { path: string; message: string };
export type ModelSchemaValidationResult =
  | { ok: true; value: ModelConsultationOutput }
  | { ok: false; errors: SchemaValidationError[] };

export type ModelConsultationRecoveryResult =
  | { ok: true; value: ModelConsultationOutput; discardedPatchFields: string[] }
  | { ok: false; errors: SchemaValidationError[] };

const MAX_MESSAGE_LENGTH = 1_000;
const MAX_TEXT_LENGTH = 500;
const MAX_AMOUNT = 10_000_000_000;
const MODEL_FIELDS = new Set(['assistantMessage', 'proposedPatch']);

export function validateModelConsultationOutput(
  input: unknown,
): ModelSchemaValidationResult {
  if (!isRecord(input)) return invalid('body', '객체 응답이 필요합니다.');
  const errors: SchemaValidationError[] = [];
  for (const key of Object.keys(input)) {
    if (!MODEL_FIELDS.has(key))
      errors.push({ path: key, message: '허용되지 않은 응답 필드입니다.' });
  }
  if (
    typeof input.assistantMessage !== 'string' ||
    !input.assistantMessage.trim() ||
    input.assistantMessage.length > MAX_MESSAGE_LENGTH
  ) {
    errors.push({
      path: 'assistantMessage',
      message: '사용자 안내 문장이 비어 있거나 너무 깁니다.',
    });
  }
  const proposedPatch = validatePatch(input.proposedPatch, errors);
  if (
    proposedPatch?.donationDesignation === 'undesignated' &&
    proposedPatch.donationCondition
  ) {
    errors.push({
      path: 'proposedPatch.donationCondition',
      message: '비지정 기부에는 기부 조건을 포함할 수 없습니다.',
    });
  }
  if (errors.length || !proposedPatch) return { ok: false, errors };
  const assistantMessage = input.assistantMessage;
  if (typeof assistantMessage !== 'string') return { ok: false, errors };
  return {
    ok: true,
    value: {
      assistantMessage: assistantMessage.trim(),
      proposedPatch,
    },
  };
}

/**
 * Keeps a usable assistant message when the model includes one or more
 * malformed patch fields. The strict validator above remains available for
 * tests and callers that need an all-or-nothing contract.
 */
export function recoverModelConsultationOutput(
  input: unknown,
): ModelConsultationRecoveryResult {
  if (!isRecord(input))
    return invalidRecovery('body', '객체 응답이 필요합니다.');
  if (
    typeof input.assistantMessage !== 'string' ||
    !input.assistantMessage.trim() ||
    input.assistantMessage.length > MAX_MESSAGE_LENGTH
  )
    return invalidRecovery(
      'assistantMessage',
      '사용자 안내 문장이 비어 있거나 너무 깁니다.',
    );

  const discardedPatchFields: string[] = [];
  const patchInput = isRecord(input.proposedPatch) ? input.proposedPatch : {};
  const patch: AiPledgePatch = {};
  for (const [field, value] of Object.entries(patchInput)) {
    const candidate = validatePledgePatch({ [field]: value });
    if (candidate.ok) Object.assign(patch, candidate.value);
    else discardedPatchFields.push(field);
  }
  if (patch.donationDesignation === 'undesignated' && patch.donationCondition) {
    delete patch.donationCondition;
    discardedPatchFields.push('donationCondition');
  }
  return {
    ok: true,
    value: {
      assistantMessage: input.assistantMessage.trim(),
      proposedPatch: patch,
    },
    discardedPatchFields,
  };
}

export function validatePledgePatch(
  input: unknown,
):
  | { ok: true; value: AiPledgePatch }
  | { ok: false; errors: SchemaValidationError[] } {
  const errors: SchemaValidationError[] = [];
  const value = validatePatch(input, errors);
  return errors.length || !value ? { ok: false, errors } : { ok: true, value };
}

function validatePatch(
  input: unknown,
  errors: SchemaValidationError[],
): AiPledgePatch | null {
  if (!isRecord(input)) {
    errors.push({ path: 'proposedPatch', message: '객체가 필요합니다.' });
    return null;
  }
  const allowed = new Set([
    'amount',
    'donationDesignation',
    'donationCondition',
    'paymentSchedule',
    'paymentScheduleOther',
    'paymentMethod',
    'paymentMethodOther',
  ]);
  for (const key of Object.keys(input))
    if (!allowed.has(key))
      errors.push({
        path: `proposedPatch.${key}`,
        message: '허용되지 않은 필드입니다.',
      });
  const value: AiPledgePatch = {};
  if ('amount' in input) {
    if (
      typeof input.amount !== 'number' ||
      !Number.isInteger(input.amount) ||
      input.amount <= 0 ||
      input.amount > MAX_AMOUNT
    )
      errors.push({
        path: 'proposedPatch.amount',
        message: '금액은 허용 범위의 양의 정수여야 합니다.',
      });
    else value.amount = input.amount;
  }
  if ('donationDesignation' in input) {
    if (
      input.donationDesignation !== 'designated' &&
      input.donationDesignation !== 'undesignated'
    )
      errors.push({
        path: 'proposedPatch.donationDesignation',
        message: '허용되지 않은 기부 유형입니다.',
      });
    else value.donationDesignation = input.donationDesignation;
  }
  for (const field of ['paymentSchedule', 'paymentMethod'] as const) {
    if (!(field in input)) continue;
    const validValues =
      field === 'paymentSchedule'
        ? ['lump_sum', 'other']
        : ['online', 'direct', 'other'];
    if (typeof input[field] !== 'string' || !validValues.includes(input[field]))
      errors.push({
        path: `proposedPatch.${field}`,
        message: '허용되지 않은 납부 선택값입니다.',
      });
    else value[field] = input[field] as never;
  }
  for (const field of [
    'donationCondition',
    'paymentScheduleOther',
    'paymentMethodOther',
  ] as const) {
    if (!(field in input)) continue;
    if (
      input[field] !== null &&
      (typeof input[field] !== 'string' ||
        !input[field].trim() ||
        input[field].length > MAX_TEXT_LENGTH)
    )
      errors.push({
        path: `proposedPatch.${field}`,
        message: '문자열이 비어 있거나 너무 깁니다.',
      });
    else value[field] = input[field] as never;
  }
  return value;
}

function invalid(path: string, message: string): ModelSchemaValidationResult {
  return { ok: false, errors: [{ path, message }] };
}

function invalidRecovery(
  path: string,
  message: string,
): ModelConsultationRecoveryResult {
  return { ok: false, errors: [{ path, message }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
