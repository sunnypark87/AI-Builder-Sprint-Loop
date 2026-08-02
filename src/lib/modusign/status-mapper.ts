import type { PledgeStatus } from '@/lib/pledges/status';

export type ModusignDocumentSnapshot = {
  abortType?: 'REJECTION' | 'REQUEST_CANCELLATION' | 'SIGNING_CANCELLATION';
  currentSigningOrder?: number;
  participants: Array<{
    role: 'donor' | 'organization';
    status: 'signed' | 'waiting' | 'declined';
  }>;
  status: string;
};

export function mapModusignDocumentStatus(
  snapshot: ModusignDocumentSnapshot,
  currentStatus: PledgeStatus,
): PledgeStatus {
  if (snapshot.status === 'ABORTED') {
    return snapshot.abortType === 'REJECTION' ? 'declined' : 'cancelled';
  }

  if (snapshot.status === 'COMPLETED') {
    return hasSigned(snapshot, 'donor') && hasSigned(snapshot, 'organization')
      ? 'signed'
      : currentStatus;
  }

  if (hasParticipantStatus(snapshot, 'organization', 'declined')) {
    return 'declined';
  }

  if (hasParticipantStatus(snapshot, 'donor', 'declined')) {
    return 'declined';
  }

  if (hasSigned(snapshot, 'organization') && hasSigned(snapshot, 'donor')) {
    return 'signed';
  }

  if (hasSigned(snapshot, 'donor')) {
    return 'awaiting_organization_signature';
  }

  if (snapshot.status === 'ON_GOING' || snapshot.currentSigningOrder === 1) {
    return 'awaiting_donor_signature';
  }

  return currentStatus;
}

function hasSigned(
  snapshot: ModusignDocumentSnapshot,
  role: 'donor' | 'organization',
) {
  return hasParticipantStatus(snapshot, role, 'signed');
}

function hasParticipantStatus(
  snapshot: ModusignDocumentSnapshot,
  role: 'donor' | 'organization',
  status: 'signed' | 'waiting' | 'declined',
) {
  return snapshot.participants.some(
    (participant) => participant.role === role && participant.status === status,
  );
}
