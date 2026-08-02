import { describe, expect, it } from 'vitest';

import {
  canCreateDemoPayment,
  canCreateSignatureRequest,
  canEditPledge,
  canStartOrganizationSigning,
  canTransitionPledge,
  isTerminalPledgeStatus,
} from './status';

describe('pledge state transitions', () => {
  it('allows only the ordered donor then organization signing flow', () => {
    expect(canTransitionPledge('draft', 'awaiting_donor_signature')).toBe(true);
    expect(
      canTransitionPledge(
        'awaiting_donor_signature',
        'awaiting_organization_signature',
      ),
    ).toBe(true);
    expect(
      canTransitionPledge('awaiting_organization_signature', 'signed'),
    ).toBe(true);
    expect(canTransitionPledge('awaiting_donor_signature', 'signed')).toBe(
      true,
    );
  });

  it('rejects state rollback and re-entry after terminal states', () => {
    expect(canTransitionPledge('signed', 'awaiting_donor_signature')).toBe(
      false,
    );
    expect(canTransitionPledge('declined', 'draft')).toBe(false);
    expect(isTerminalPledgeStatus('cancelled')).toBe(true);
  });

  it('allows editing and requesting only from draft', () => {
    expect(canEditPledge('draft')).toBe(true);
    expect(canEditPledge('awaiting_donor_signature')).toBe(false);
    expect(canCreateSignatureRequest('draft')).toBe(true);
    expect(canCreateSignatureRequest('signed')).toBe(false);
  });

  it('requires verified donor signing before organization signing', () => {
    expect(
      canStartOrganizationSigning({
        pledgeStatus: 'awaiting_organization_signature',
        donorStatus: 'signed',
      }),
    ).toBe(true);
    expect(
      canStartOrganizationSigning({
        pledgeStatus: 'awaiting_organization_signature',
        donorStatus: 'waiting',
      }),
    ).toBe(false);
  });

  it('opens demo payment only after both signatures complete', () => {
    expect(canCreateDemoPayment('signed')).toBe(true);
    expect(canCreateDemoPayment('awaiting_organization_signature')).toBe(false);
  });
});
