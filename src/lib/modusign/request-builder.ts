import type { ValidatedPledgeInput } from '@/lib/pledges/input';

import {
  MODUSIGN_DONATION_TEMPLATE_ID,
  donationTemplateFields,
} from './template-mapping';

export type SignatureRequestPledge = ValidatedPledgeInput & {
  id: string;
};

export type OrganizationSigner = {
  email: string;
  name: string;
};

type PrefilledValue = string | boolean;

type ParticipantMapping = {
  fieldMappings: Array<{
    dataLabel: string;
    excluded: boolean;
    prefilledValue?: PrefilledValue;
  }>;
  name: string;
  role: string;
  signingMethod: { type: 'SECURE_LINK'; value: string };
};

export type ModusignSignatureRequestBody = {
  document: {
    metadatas: Array<{ key: string; value: string }>;
    participantMappings: ParticipantMapping[];
    title: string;
  };
  templateId: string;
};

export function buildDonationSignatureRequest(
  pledge: SignatureRequestPledge,
  organizationSigner: OrganizationSigner,
  templateId = MODUSIGN_DONATION_TEMPLATE_ID,
): ModusignSignatureRequestBody {
  return {
    document: {
      metadatas: [
        { key: 'pledge_id', value: pledge.id },
        { key: 'organization_slug', value: pledge.organizationSlug },
      ],
      participantMappings: [
        {
          fieldMappings: buildFieldMappings(pledge),
          name: pledge.donorName,
          role: '기부자',
          signingMethod: {
            type: 'SECURE_LINK',
            value: pledge.donorEmail || '',
          },
        },
        {
          fieldMappings: [],
          name: organizationSigner.name,
          role: '기부처',
          signingMethod: {
            type: 'SECURE_LINK',
            value: organizationSigner.email,
          },
        },
      ],
      title: `기부 약정서-${pledge.id}`,
    },
    templateId,
  };
}

function buildFieldMappings(pledge: SignatureRequestPledge) {
  const values: Record<string, PrefilledValue | undefined> = {
    address: pledge.address,
    amount: String(pledge.amount),
    contact: pledge.contact,
    donationCondition: formatDonationCondition(
      pledge.purpose,
      pledge.donationCondition,
    ),
    donationKindCash: pledge.donationKind === 'cash',
    donationKindOther: pledge.donationKind === 'other',
    donationTypeOther:
      pledge.donationKind === 'other' ? pledge.donationKindOther : undefined,
    donorName: pledge.donorName,
    email: pledge.donorEmail,
    finalDonorName: pledge.donorName,
    identityInfoConsent: pledge.identityInfoConsent,
    identityNumber: pledge.identityNumber,
    paymentMethodDirect: pledge.paymentMethod === 'direct',
    paymentMethodOnline: pledge.paymentMethod === 'online',
    paymentMethodOther: pledge.paymentMethod === 'other',
    paymentMethodOtherText:
      pledge.paymentMethod === 'other' ? pledge.paymentMethodOther : undefined,
    paymentMethodLumpSum: pledge.paymentSchedule === 'lump_sum',
    paymentScheduleOther:
      pledge.paymentSchedule === 'other'
        ? pledge.paymentScheduleOther
        : undefined,
    personalInfoConsent: pledge.personalInfoConsent,
    pledgeDate: pledge.pledgeDate,
    receiptRequested: pledge.receiptRequested,
    thirdPartyInfoConsent: pledge.thirdPartyInfoConsent,
  };

  return donationTemplateFields
    .filter(
      (field) => field.type !== 'SIGNATURE' && field.type !== 'SIGNING_DATE',
    )
    .map((field) => {
      const value = getFieldValue(field, values, pledge);

      return {
        dataLabel: field.dataLabel,
        excluded: value === undefined,
        ...(value === undefined ? {} : { prefilledValue: value }),
      };
    });
}

export function formatDonationCondition(
  purpose: string,
  donationCondition?: string,
) {
  return [
    `기부 목적: ${purpose.trim()}`,
    donationCondition?.trim()
      ? `기부 조건: ${donationCondition.trim()}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n');
}

function getFieldValue(
  field: (typeof donationTemplateFields)[number],
  values: Record<string, PrefilledValue | undefined>,
  pledge: SignatureRequestPledge,
) {
  if (field.key === 'donationDesignation') {
    return field.valueDescription === '지정 기부'
      ? pledge.donationDesignation === 'designated'
      : pledge.donationDesignation === 'undesignated';
  }
  if (field.key === 'paymentMethodOther') {
    return field.groupLabel === '7c15e9f7'
      ? pledge.paymentSchedule === 'other'
      : pledge.paymentMethod === 'other';
  }
  if (field.key === 'receiptRequested') {
    return field.valueDescription === '예'
      ? pledge.receiptRequested
      : !pledge.receiptRequested;
  }
  if (field.key === 'personalInfoConsent') {
    return field.valueDescription === '동의합니다'
      ? pledge.personalInfoConsent
      : pledge.personalInfoConsent === false;
  }
  if (field.key === 'thirdPartyInfoConsent') {
    return field.valueDescription === '동의합니다'
      ? pledge.thirdPartyInfoConsent
      : pledge.thirdPartyInfoConsent === false;
  }
  if (field.key === 'identityInfoConsent') {
    return field.valueDescription === '동의합니다'
      ? pledge.identityInfoConsent
      : pledge.identityInfoConsent === false;
  }
  return values[field.key];
}
