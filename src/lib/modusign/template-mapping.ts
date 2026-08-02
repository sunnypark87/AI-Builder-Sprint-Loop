export const MODUSIGN_DONATION_TEMPLATE_ID =
  '38ee3310-8d79-11f1-9fa9-c50a521cd0a6';

export const donationOrganizationTemplateFields: DonationTemplateField[] = [
  {
    dataLabel: 'e8127468',
    key: 'organizationSignature',
    required: true,
    type: 'SIGNATURE',
  },
];

export type DonationTemplateField = {
  dataLabel: string;
  groupLabel?: string;
  key: string;
  required: boolean;
  type: 'CHECKBOX' | 'DATE' | 'SIGNATURE' | 'TEXT' | 'SIGNING_DATE';
  valueDescription?: string;
};

const textFields: DonationTemplateField[] = [
  {
    dataLabel: 'd9b981f5',
    key: 'donorName',
    required: true,
    type: 'TEXT',
  },
  {
    dataLabel: 'a80b31b9',
    key: 'address',
    required: true,
    type: 'TEXT',
  },
  {
    dataLabel: '2e478488',
    key: 'identityNumber',
    required: true,
    type: 'TEXT',
  },
  {
    dataLabel: 'ce31105e',
    key: 'contact',
    required: true,
    type: 'TEXT',
  },
  {
    dataLabel: '6969cc30',
    key: 'email',
    required: false,
    type: 'TEXT',
  },
  {
    dataLabel: 'f4293acb',
    key: 'donationTypeOther',
    required: false,
    type: 'TEXT',
  },
  {
    dataLabel: 'e94153bb',
    key: 'amount',
    required: true,
    type: 'TEXT',
  },
  {
    dataLabel: '345ef87c',
    key: 'pledgeDate',
    required: true,
    type: 'DATE',
  },
  {
    dataLabel: '9ff2472f',
    key: 'donationCondition',
    required: false,
    type: 'TEXT',
  },
  {
    dataLabel: 'e5251eec',
    key: 'paymentScheduleOther',
    required: false,
    type: 'TEXT',
  },
  {
    dataLabel: 'fb24dc57',
    key: 'paymentMethodOtherText',
    required: false,
    type: 'TEXT',
  },
  {
    dataLabel: 'cbb1a427',
    key: 'signingDate',
    required: false,
    type: 'SIGNING_DATE',
  },
  {
    dataLabel: '704fd952',
    key: 'finalDonorName',
    required: true,
    type: 'TEXT',
  },
  {
    dataLabel: 'd0884f23',
    key: 'signature',
    required: true,
    type: 'SIGNATURE',
  },
];

const checkboxFieldTuples = [
  ['9fb02fa3', '1', 'donationKindCash', '현금'],
  ['9fb02fa3', '2', 'donationKindOther', '기타'],
  ['0310dbfc', '1', 'donationDesignation', '지정 기부'],
  ['0310dbfc', '2', 'donationDesignation', '비지정 기부'],
  ['7c15e9f7', '1', 'paymentMethodLumpSum', '일시 납부'],
  ['7c15e9f7', '2', 'paymentMethodOther', '기타'],
  ['a67c285c', '1', 'paymentMethodOnline', '온라인 납부'],
  ['a67c285c', '2', 'paymentMethodDirect', '직접 전달'],
  ['a67c285c', '3', 'paymentMethodOther', '기타'],
  ['a2495e23', '1', 'receiptRequested', '예'],
  ['a2495e23', '2', 'receiptRequested', '아니오'],
  ['e40f8af5', '1', 'personalInfoConsent', '동의합니다'],
  ['e40f8af5', '2', 'personalInfoConsent', '동의하지 않습니다'],
  ['18dde5ef', '1', 'thirdPartyInfoConsent', '동의합니다'],
  ['18dde5ef', '2', 'thirdPartyInfoConsent', '동의하지 않습니다'],
  ['728b8010', '1', 'identityInfoConsent', '동의합니다'],
  ['728b8010', '2', 'identityInfoConsent', '동의하지 않습니다'],
] as const;

const checkboxFields: DonationTemplateField[] = checkboxFieldTuples.map(
  ([groupLabel, dataLabel, key, valueDescription]) => ({
    dataLabel,
    ...(groupLabel ? { groupLabel } : {}),
    key,
    required: false,
    type: 'CHECKBOX' as const,
    valueDescription,
  }),
);

export const donationTemplateFields = [...textFields, ...checkboxFields];

export function getDonationTemplateField(key: string) {
  return donationTemplateFields.find((field) => field.key === key);
}

export function getDonationTemplateFieldKey(field: {
  dataLabel: string;
  groupLabel?: string | null;
}) {
  return field.groupLabel
    ? `${field.groupLabel}:${field.dataLabel}`
    : field.dataLabel;
}
