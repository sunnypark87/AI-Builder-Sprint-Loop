import { describe, expect, it } from 'vitest';

import {
  buildDonationSignatureRequest,
  formatDonationCondition,
} from './request-builder';

const pledge = {
  address: '부산시 해운대구',
  amount: 50000,
  contact: '010-0000-0000',
  donorEmail: 'donor@example.com',
  donorName: '홍길동',
  identityNumber: '9001011234567',
  donationType: 'cash',
  organizationSlug: 'haebom',
  pledgeDate: '2026-08-01',
  purpose: '교육 프로그램',
  receiptRequested: true,
  id: 'pledge-1',
} as const;

describe('donation Modusign request builder', () => {
  it('combines purpose and donation condition into the template condition field', () => {
    expect(formatDonationCondition('교육 프로그램', '분기별 공개')).toBe(
      '기부 목적: 교육 프로그램\n기부 조건: 분기별 공개',
    );
  });
  it('creates donor-first secure-link participants with stable metadata', () => {
    const body = buildDonationSignatureRequest(pledge, {
      email: 'signer@example.com',
      name: '해봄재단 담당자',
    });

    expect(body.document.participantMappings.map((item) => item.role)).toEqual([
      '기부자',
      '기부처',
    ]);
    expect(body.document.participantMappings[0].signingMethod).toEqual({
      type: 'SECURE_LINK',
      value: 'donor@example.com',
    });
    expect(body.document.participantMappings[1].signingMethod).toEqual({
      type: 'SECURE_LINK',
      value: 'signer@example.com',
    });
    expect(body.document.metadatas).toContainEqual({
      key: 'pledge_id',
      value: 'pledge-1',
    });
  });

  it('maps the required identity number to the donor field', () => {
    const body = buildDonationSignatureRequest(pledge, {
      email: 'signer@example.com',
      name: '해봄재단 담당자',
    });
    const identityMapping =
      body.document.participantMappings[0].fieldMappings.find(
        (field) => field.dataLabel === '2e478488',
      );

    expect(identityMapping).toEqual({
      dataLabel: '2e478488',
      excluded: false,
      prefilledValue: '9001011234567',
    });
  });

  it('prefills the template choice fields from the completed pledge', () => {
    const body = buildDonationSignatureRequest(
      {
        ...pledge,
        donationDesignation: 'designated',
        donationKind: 'cash',
        paymentMethod: 'online',
        paymentSchedule: 'lump_sum',
        personalInfoConsent: true,
        thirdPartyInfoConsent: true,
      },
      { email: 'signer@example.com', name: '해봄재단 담당자' },
    );
    const mappings = body.document.participantMappings[0].fieldMappings;

    expect(mappings).toContainEqual({
      dataLabel: '1',
      excluded: false,
      prefilledValue: true,
    });
    expect(mappings).toContainEqual({
      dataLabel: '1',
      excluded: false,
      prefilledValue: true,
    });
    expect(mappings).toContainEqual({
      dataLabel: '1',
      excluded: false,
      prefilledValue: true,
    });
  });

  it('prefills the new free-text fields for other payment choices', () => {
    const body = buildDonationSignatureRequest(
      {
        ...pledge,
        donationKind: 'other',
        donationKindOther: '교육 기자재',
        paymentMethod: 'other',
        paymentMethodOther: '재단 협의 후 전달',
        paymentSchedule: 'other',
        paymentScheduleOther: '분기별 납부',
      },
      { email: 'signer@example.com', name: '해봄재단 담당자' },
    );
    const mappings = body.document.participantMappings[0].fieldMappings;

    expect(mappings).toContainEqual({
      dataLabel: 'f4293acb',
      excluded: false,
      prefilledValue: '교육 기자재',
    });
    expect(mappings).toContainEqual({
      dataLabel: 'e5251eec',
      excluded: false,
      prefilledValue: '분기별 납부',
    });
    expect(mappings).toContainEqual({
      dataLabel: 'fb24dc57',
      excluded: false,
      prefilledValue: '재단 협의 후 전달',
    });
  });
});
