import { describe, expect, it } from 'vitest';

import {
  hasSignatureAdvanced,
  shouldCompleteSignatureSync,
} from './pledge-status-sync-button';

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

  it('waits for the final signed state when the waiting page syncs', () => {
    expect(
      shouldCompleteSignatureSync(
        'donor',
        'awaiting_organization_signature',
        true,
      ),
    ).toBe(false);
    expect(shouldCompleteSignatureSync('donor', 'signed', true)).toBe(true);
  });
});
