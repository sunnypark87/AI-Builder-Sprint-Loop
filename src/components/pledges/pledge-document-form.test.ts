import { describe, expect, it } from 'vitest';

import {
  getMissingReviewFields,
  type EditablePledge,
  type ReviewFormValues,
} from './pledge-document-form';

const completeForm: ReviewFormValues = {
  donorName: '홍길동',
  address: '서울시 중구',
  identityNumber: '900101-1234567',
  contact: '010-1234-5678',
  donationKind: 'cash',
  donationKindOther: '',
  amount: '100000',
  pledgeDate: '2026-08-03',
  donationDesignation: 'undesignated',
  donationCondition: '',
  paymentSchedule: 'lump_sum',
  paymentScheduleOther: '',
  paymentMethod: 'online',
  paymentMethodOther: '',
  personalInfoConsent: true,
  thirdPartyInfoConsent: true,
  identityInfoConsent: true,
};

const pledge = { donor_identity_number_last4: null } as EditablePledge;

describe('pledge document review fields', () => {
  it('has no guided fields when required information is complete', () => {
    expect(getMissingReviewFields(completeForm, pledge)).toEqual([]);
  });

  it('adds only applicable conditional fields', () => {
    const fields = getMissingReviewFields(
      {
        ...completeForm,
        donationDesignation: 'designated',
        donationCondition: '',
        paymentMethod: 'other',
        paymentMethodOther: '',
      },
      pledge,
    ).map((field) => field.key);

    expect(fields).toEqual(['donationCondition', 'paymentMethodOther']);
  });

  it('guides invalid identity and contact values as incomplete', () => {
    const fields = getMissingReviewFields(
      { ...completeForm, identityNumber: '900101', contact: '010-12' },
      pledge,
    ).map((field) => field.key);

    expect(fields).toEqual(['identityNumber', 'contact']);
  });
});
