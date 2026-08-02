import { describe, expect, it } from 'vitest';

import { validateCreatePledgeInput, validateDraftPledgeInput } from './input';

const validInput = {
  address: '부산시 해운대구',
  amount: 50000,
  contact: '010-0000-0000',
  donorName: '홍길동',
  donationType: 'cash',
  organizationSlug: 'haebom',
  pledgeDate: '2026-08-01',
  purpose: '교육 프로그램',
  receiptRequested: false,
};

describe('create pledge input validation', () => {
  it('accepts an identity number for the individual donor template', () => {
    const result = validateCreatePledgeInput({
      ...validInput,
      identityNumber: '000000-0000000',
      purpose: '  교육 프로그램  ',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.purpose).toBe('교육 프로그램');
      expect(result.value.identityNumber).toBe('000000-0000000');
    }
  });

  it('reports required and invalid amount/date fields', () => {
    const result = validateCreatePledgeInput({
      ...validInput,
      amount: 0,
      pledgeDate: 'not-a-date',
      purpose: '',
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.errors.map((error) => error.field)).toEqual(
        expect.arrayContaining(['amount', 'pledgeDate', 'purpose']),
      );
    }
  });

  it('normalizes digit-only identity and mobile numbers', () => {
    const result = validateCreatePledgeInput({
      ...validInput,
      contact: '01012345678',
      identityNumber: '9001011234567',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contact).toBe('010-1234-5678');
      expect(result.value.identityNumber).toBe('900101-1234567');
    }
  });

  it('rejects invalid mobile, email, and identity formats', () => {
    const result = validateCreatePledgeInput({
      ...validInput,
      contact: '0212345678',
      donorEmail: 'invalid@email',
      identityNumber: '900101123',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.field)).toEqual(
        expect.arrayContaining(['contact', 'donorEmail', 'identityNumber']),
      );
    }
  });

  it('requires recipient details when a demo receipt is requested', () => {
    const result = validateCreatePledgeInput({
      ...validInput,
      receiptRequested: true,
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.errors.map((error) => error.field)).toEqual(
        expect.arrayContaining([
          'receiptRecipientName',
          'receiptRecipientAddress',
        ]),
      );
    }
  });
});

describe('draft pledge input validation', () => {
  it('allows empty optional contact fields in an incomplete draft', () => {
    expect(
      validateDraftPledgeInput({
        contact: '',
        donorEmail: '',
        identityNumber: '',
        organizationSlug: 'haebom',
      }),
    ).toMatchObject({ ok: true });
  });

  it('rejects malformed contact fields when supplied', () => {
    const result = validateDraftPledgeInput({
      contact: '010123',
      donorEmail: 'invalid',
      identityNumber: '123456',
      organizationSlug: 'haebom',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.field)).toEqual(
        expect.arrayContaining(['contact', 'donorEmail', 'identityNumber']),
      );
    }
  });
});
