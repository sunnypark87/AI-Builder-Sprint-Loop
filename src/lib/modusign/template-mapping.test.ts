import { describe, expect, it } from 'vitest';

import {
  donationTemplateFields,
  donationOrganizationTemplateFields,
  getDonationTemplateField,
  getDonationTemplateFieldKey,
  MODUSIGN_DONATION_TEMPLATE_ID,
} from './template-mapping';

describe('donation Modusign template mapping', () => {
  it('tracks the configured template and all 31 donor fields', () => {
    expect(MODUSIGN_DONATION_TEMPLATE_ID).toBe(
      '38ee3310-8d79-11f1-9fa9-c50a521cd0a6',
    );
    expect(donationTemplateFields).toHaveLength(31);
    expect(
      new Set(
        donationTemplateFields.map((field) =>
          getDonationTemplateFieldKey(field),
        ),
      ).size,
    ).toBe(31);
  });

  it('requires the identity number in the updated donor template', () => {
    expect(getDonationTemplateField('identityNumber')).toMatchObject({
      dataLabel: '2e478488',
      required: true,
    });
  });

  it('tracks the required organization signature field separately', () => {
    expect(donationOrganizationTemplateFields).toEqual([
      expect.objectContaining({
        dataLabel: 'e8127468',
        key: 'organizationSignature',
        required: true,
        type: 'SIGNATURE',
      }),
    ]);
  });

  it('distinguishes checkbox options that reuse data labels by group', () => {
    expect(
      getDonationTemplateFieldKey({
        dataLabel: '1',
        groupLabel: '9fb02fa3',
      }),
    ).toBe('9fb02fa3:1');
    expect(
      getDonationTemplateFieldKey({
        dataLabel: '1',
        groupLabel: 'a2495e23',
      }),
    ).toBe('a2495e23:1');
  });
});
