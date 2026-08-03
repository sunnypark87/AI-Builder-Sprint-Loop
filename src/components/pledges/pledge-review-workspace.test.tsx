import { describe, expect, it } from 'vitest';

import type { EditablePledge } from './pledge-document-form';
import { mergePledgeChatPatch } from './pledge-review-workspace';

describe('pledge review workspace', () => {
  it('synchronizes an automatically applied AI patch and pledge version', () => {
    const pledge = {
      amount: 100000,
      donation_designation: null,
      payment_method: null,
      version: 3,
    } as EditablePledge;

    expect(
      mergePledgeChatPatch(
        pledge,
        { amount: 250000, paymentMethod: 'online' },
        4,
      ),
    ).toMatchObject({
      amount: 250000,
      payment_method: 'online',
      version: 4,
    });
  });

  it('merges only AI fields without replacing unrelated unsaved form fields', () => {
    const pledge = {
      amount: 100000,
      donor_name: '기부자',
      donation_designation: null,
      payment_method: null,
      version: 3,
    } as EditablePledge;

    expect(
      mergePledgeChatPatch(pledge, { paymentMethod: 'online' }, 4),
    ).toMatchObject({
      amount: 100000,
      donor_name: '기부자',
      payment_method: 'online',
      version: 4,
    });
  });
});
