import { describe, expect, it } from 'vitest';

import { validateDraftPledgeInput } from './input';

describe('validateDraftPledgeInput', () => {
  it('allows an incomplete draft so the user can review the document first', () => {
    expect(validateDraftPledgeInput({ organizationSlug: 'haebom' })).toEqual({
      ok: true,
      value: { organizationSlug: 'haebom', receiptRequested: false },
    });
  });

  it('still rejects an invalid optional draft value', () => {
    expect(
      validateDraftPledgeInput({ organizationSlug: 'haebom', amount: 0 }),
    ).toEqual({
      ok: false,
      errors: [
        { field: 'amount', message: '금액은 0보다 큰 숫자여야 합니다.' },
      ],
    });
  });
});
