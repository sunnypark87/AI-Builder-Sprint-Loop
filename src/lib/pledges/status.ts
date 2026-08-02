export const pledgeStatuses = [
  'draft',
  'awaiting_donor_signature',
  'awaiting_organization_signature',
  'signed',
  'declined',
  'cancelled',
  'expired',
] as const;

export type PledgeStatus = (typeof pledgeStatuses)[number];

export const participantStatuses = ['waiting', 'signed', 'declined'] as const;

export type ParticipantStatus = (typeof participantStatuses)[number];

export const syncStatuses = [
  'idle',
  'syncing',
  'failed',
  'reconciliation_required',
] as const;

export type SyncStatus = (typeof syncStatuses)[number];

const terminalPledgeStatuses = new Set<PledgeStatus>([
  'signed',
  'declined',
  'cancelled',
  'expired',
]);

const allowedPledgeTransitions: Record<PledgeStatus, readonly PledgeStatus[]> =
  {
    draft: ['awaiting_donor_signature', 'cancelled'],
    awaiting_donor_signature: [
      'awaiting_organization_signature',
      'signed',
      'declined',
      'cancelled',
      'expired',
    ],
    awaiting_organization_signature: [
      'signed',
      'declined',
      'cancelled',
      'expired',
    ],
    signed: [],
    declined: [],
    cancelled: [],
    expired: [],
  };

export function canTransitionPledge(from: PledgeStatus, to: PledgeStatus) {
  return from === to || allowedPledgeTransitions[from].includes(to);
}

export function isTerminalPledgeStatus(status: PledgeStatus) {
  return terminalPledgeStatuses.has(status);
}

export function canEditPledge(status: PledgeStatus) {
  return status === 'draft';
}

export function canCreateSignatureRequest(status: PledgeStatus) {
  return status === 'draft';
}

export function canStartOrganizationSigning({
  pledgeStatus,
  donorStatus,
}: {
  pledgeStatus: PledgeStatus;
  donorStatus: ParticipantStatus;
}) {
  return (
    pledgeStatus === 'awaiting_organization_signature' &&
    donorStatus === 'signed'
  );
}

export function canCreateDemoPayment(status: PledgeStatus) {
  return status === 'signed';
}
