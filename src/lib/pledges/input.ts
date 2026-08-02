import {
  formatIdentityNumberInput,
  formatMobilePhoneInput,
  isValidEmailInput,
  isValidIdentityNumberInput,
  isValidMobilePhoneInput,
} from './contact-format';

export type CreatePledgeInput = {
  address: string;
  amount: number;
  allocationEndDate?: string;
  allocationMonths?: number;
  allocationStartDate?: string;
  anonymousRequested?: boolean;
  contact: string;
  contactPerson?: string;
  department?: string;
  donorName: string;
  donorEmail?: string;
  identityNumber?: string;
  donationCondition?: string;
  donationDesignation?: 'designated' | 'undesignated';
  donationKind?: 'cash' | 'other';
  donationKindOther?: string;
  donationType: string;
  identityInfoConsent?: boolean;
  organizationSlug: string;
  paymentMethod?: 'online' | 'direct' | 'other';
  paymentMethodOther?: string;
  paymentSchedule?: 'lump_sum' | 'other';
  paymentScheduleOther?: string;
  personalInfoConsent?: boolean;
  pledgeDate: string;
  purpose: string;
  receiptRecipientAddress?: string;
  receiptRecipientName?: string;
  receiptRequested: boolean;
  thirdPartyInfoConsent?: boolean;
};

export type UpdatePledgeInput = CreatePledgeInput & { version?: number };

export type DraftPledgeInput = Partial<CreatePledgeInput> & {
  organizationSlug: string;
};

export type ValidatedPledgeInput = Omit<
  CreatePledgeInput,
  'amount' | 'pledgeDate'
> & {
  amount: number;
  pledgeDate: string;
};

export type PledgeInputError = {
  field: string;
  message: string;
};

export function validateCreatePledgeInput(
  input: unknown,
):
  | { ok: true; value: ValidatedPledgeInput }
  | { ok: false; errors: PledgeInputError[] } {
  if (!isRecord(input)) {
    return {
      errors: [{ field: 'body', message: '요청 형식이 올바르지 않습니다.' }],
      ok: false,
    };
  }

  const errors: PledgeInputError[] = [];
  const requiredFields = [
    ['organizationSlug', '기부처'],
    ['donorName', '기부자명'],
    ['address', '주소'],
    ['contact', '연락처'],
    ['donationType', '기부 유형'],
    ['purpose', '기부 목적'],
    ['pledgeDate', '약정일'],
  ] as const;

  for (const [field, label] of requiredFields) {
    if (typeof input[field] !== 'string' || !input[field].trim()) {
      errors.push({ field, message: `${label}을(를) 입력해 주세요.` });
    }
  }

  const amount = input.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    errors.push({
      field: 'amount',
      message: '금액은 0보다 큰 숫자여야 합니다.',
    });
  }

  const pledgeDate = input.pledgeDate;
  if (typeof pledgeDate === 'string' && pledgeDate && !isIsoDate(pledgeDate)) {
    errors.push({
      field: 'pledgeDate',
      message: '약정일 형식이 올바르지 않습니다.',
    });
  }

  if (
    input.identityNumber !== undefined &&
    (typeof input.identityNumber !== 'string' ||
      !isValidIdentityNumberInput(input.identityNumber))
  ) {
    errors.push({
      field: 'identityNumber',
      message: '주민등록번호 형식이 올바르지 않습니다.',
    });
  }
  if (
    typeof input.contact === 'string' &&
    !isValidMobilePhoneInput(input.contact)
  ) {
    errors.push({
      field: 'contact',
      message: '휴대폰 번호 형식이 올바르지 않습니다.',
    });
  }
  if (
    typeof input.donorEmail === 'string' &&
    input.donorEmail.trim() &&
    !isValidEmailInput(input.donorEmail)
  ) {
    errors.push({
      field: 'donorEmail',
      message: '이메일 형식이 올바르지 않습니다.',
    });
  }

  if (errors.length > 0) {
    return { errors, ok: false };
  }

  return {
    ok: true,
    value: {
      address: requiredString(input.address),
      amount: amount as number,
      ...(typeof input.allocationEndDate === 'string'
        ? { allocationEndDate: input.allocationEndDate }
        : {}),
      ...(typeof input.allocationMonths === 'number'
        ? { allocationMonths: input.allocationMonths }
        : {}),
      ...(typeof input.allocationStartDate === 'string'
        ? { allocationStartDate: input.allocationStartDate }
        : {}),
      anonymousRequested: input.anonymousRequested === true,
      contact: formatMobilePhoneInput(requiredString(input.contact)),
      contactPerson: optionalString(input.contactPerson),
      department: optionalString(input.department),
      donorName: requiredString(input.donorName),
      donorEmail: optionalString(input.donorEmail),
      identityNumber:
        typeof input.identityNumber === 'string'
          ? formatIdentityNumberInput(input.identityNumber)
          : undefined,
      donationCondition: optionalString(input.donationCondition),
      ...(isEnum(input.donationDesignation, ['designated', 'undesignated'])
        ? { donationDesignation: input.donationDesignation }
        : {}),
      ...(isEnum(input.donationKind, ['cash', 'other'])
        ? { donationKind: input.donationKind }
        : {}),
      donationKindOther: optionalString(input.donationKindOther),
      donationType: requiredString(input.donationType),
      ...(typeof input.identityInfoConsent === 'boolean'
        ? { identityInfoConsent: input.identityInfoConsent }
        : {}),
      organizationSlug: requiredString(input.organizationSlug),
      ...(isEnum(input.paymentMethod, ['online', 'direct', 'other'])
        ? { paymentMethod: input.paymentMethod }
        : {}),
      paymentMethodOther: optionalString(input.paymentMethodOther),
      ...(isEnum(input.paymentSchedule, ['lump_sum', 'other'])
        ? { paymentSchedule: input.paymentSchedule }
        : {}),
      paymentScheduleOther: optionalString(input.paymentScheduleOther),
      ...(typeof input.personalInfoConsent === 'boolean'
        ? { personalInfoConsent: input.personalInfoConsent }
        : {}),
      pledgeDate: pledgeDate as string,
      purpose: requiredString(input.purpose),
      receiptRecipientAddress:
        input.receiptRequested === true
          ? requiredString(input.address)
          : undefined,
      receiptRecipientName:
        input.receiptRequested === true
          ? requiredString(input.donorName)
          : undefined,
      receiptRequested: input.receiptRequested === true,
      ...(typeof input.thirdPartyInfoConsent === 'boolean'
        ? { thirdPartyInfoConsent: input.thirdPartyInfoConsent }
        : {}),
    },
  };
}

export function validateDraftPledgeInput(
  input: unknown,
):
  | { ok: true; value: DraftPledgeInput }
  | { ok: false; errors: PledgeInputError[] } {
  if (!isRecord(input)) {
    return {
      errors: [{ field: 'body', message: '요청 형식이 올바르지 않습니다.' }],
      ok: false,
    };
  }

  if (
    typeof input.organizationSlug !== 'string' ||
    !input.organizationSlug.trim()
  ) {
    return {
      errors: [
        { field: 'organizationSlug', message: '기부처를 선택해 주세요.' },
      ],
      ok: false,
    };
  }
  const errors: PledgeInputError[] = [];
  if (
    input.contact !== undefined &&
    (typeof input.contact !== 'string' ||
      (input.contact.trim() && !isValidMobilePhoneInput(input.contact)))
  ) {
    errors.push({
      field: 'contact',
      message: '휴대폰 번호 형식이 올바르지 않습니다.',
    });
  }
  if (
    input.donorEmail !== undefined &&
    (typeof input.donorEmail !== 'string' ||
      (input.donorEmail.trim() && !isValidEmailInput(input.donorEmail)))
  ) {
    errors.push({
      field: 'donorEmail',
      message: '이메일 형식이 올바르지 않습니다.',
    });
  }
  if (
    input.identityNumber !== undefined &&
    (typeof input.identityNumber !== 'string' ||
      (input.identityNumber.trim() &&
        !isValidIdentityNumberInput(input.identityNumber)))
  ) {
    errors.push({
      field: 'identityNumber',
      message: '주민등록번호 형식이 올바르지 않습니다.',
    });
  }

  if (
    input.amount !== undefined &&
    (typeof input.amount !== 'number' ||
      !Number.isFinite(input.amount) ||
      input.amount <= 0)
  ) {
    errors.push({
      field: 'amount',
      message: '금액은 0보다 큰 숫자여야 합니다.',
    });
  }
  if (
    input.pledgeDate !== undefined &&
    (typeof input.pledgeDate !== 'string' || !isIsoDate(input.pledgeDate))
  ) {
    errors.push({
      field: 'pledgeDate',
      message: '약정일 형식이 올바르지 않습니다.',
    });
  }
  if (errors.length) return { errors, ok: false };

  return {
    ok: true,
    value: {
      organizationSlug: input.organizationSlug.trim(),
      ...(typeof input.allocationEndDate === 'string'
        ? { allocationEndDate: input.allocationEndDate }
        : {}),
      ...(typeof input.allocationMonths === 'number'
        ? { allocationMonths: input.allocationMonths }
        : {}),
      ...(typeof input.allocationStartDate === 'string'
        ? { allocationStartDate: input.allocationStartDate }
        : {}),
      ...(typeof input.anonymousRequested === 'boolean'
        ? { anonymousRequested: input.anonymousRequested }
        : {}),
      ...(typeof input.address === 'string'
        ? { address: input.address.trim() }
        : {}),
      ...(typeof input.amount === 'number' ? { amount: input.amount } : {}),
      ...(typeof input.contact === 'string'
        ? { contact: formatMobilePhoneInput(input.contact) }
        : {}),
      ...(typeof input.contactPerson === 'string'
        ? { contactPerson: input.contactPerson.trim() }
        : {}),
      ...(typeof input.department === 'string'
        ? { department: input.department.trim() }
        : {}),
      ...(typeof input.donorName === 'string'
        ? { donorName: input.donorName.trim() }
        : {}),
      ...(typeof input.donorEmail === 'string'
        ? { donorEmail: input.donorEmail.trim() }
        : {}),
      ...(typeof input.identityNumber === 'string'
        ? { identityNumber: formatIdentityNumberInput(input.identityNumber) }
        : {}),
      ...(typeof input.donationCondition === 'string'
        ? { donationCondition: input.donationCondition.trim() }
        : {}),
      ...(isEnum(input.donationDesignation, ['designated', 'undesignated'])
        ? { donationDesignation: input.donationDesignation }
        : {}),
      ...(isEnum(input.donationKind, ['cash', 'other'])
        ? { donationKind: input.donationKind }
        : {}),
      ...(typeof input.donationKindOther === 'string'
        ? { donationKindOther: input.donationKindOther.trim() }
        : {}),
      ...(typeof input.donationType === 'string'
        ? { donationType: input.donationType.trim() }
        : {}),
      ...(typeof input.identityInfoConsent === 'boolean'
        ? { identityInfoConsent: input.identityInfoConsent }
        : {}),
      ...(isEnum(input.paymentMethod, ['online', 'direct', 'other'])
        ? { paymentMethod: input.paymentMethod }
        : {}),
      ...(typeof input.paymentMethodOther === 'string'
        ? { paymentMethodOther: input.paymentMethodOther.trim() }
        : {}),
      ...(isEnum(input.paymentSchedule, ['lump_sum', 'other'])
        ? { paymentSchedule: input.paymentSchedule }
        : {}),
      ...(typeof input.paymentScheduleOther === 'string'
        ? { paymentScheduleOther: input.paymentScheduleOther.trim() }
        : {}),
      ...(typeof input.personalInfoConsent === 'boolean'
        ? { personalInfoConsent: input.personalInfoConsent }
        : {}),
      ...(typeof input.pledgeDate === 'string'
        ? { pledgeDate: input.pledgeDate }
        : {}),
      ...(typeof input.purpose === 'string'
        ? { purpose: input.purpose.trim() }
        : {}),
      receiptRequested: input.receiptRequested === true,
      ...(typeof input.thirdPartyInfoConsent === 'boolean'
        ? { thirdPartyInfoConsent: input.thirdPartyInfoConsent }
        : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isEnum<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
