import { describe, expect, it } from 'vitest';

import { hasSignatureAdvanced } from './pledge-status-sync-button';

describe('signature status polling', () => {
  it('keeps polling while the donor signature is pending', () => {
    expect(hasSignatureAdvanced('donor', 'awaiting_donor_signature')).toBe(
      false,
    );
    expect(
      hasSignatureAdvanced('donor', 'awaiting_organization_signature'),
    ).toBe(true);
  });

  it('keeps polling while the organization signature is pending', () => {
    expect(
      hasSignatureAdvanced('organization', 'awaiting_organization_signature'),
    ).toBe(false);
    expect(hasSignatureAdvanced('organization', 'signed')).toBe(true);
  });

  it('does not treat a failed response without status as completion', () => {
    expect(hasSignatureAdvanced('donor')).toBe(false);
  });
});
