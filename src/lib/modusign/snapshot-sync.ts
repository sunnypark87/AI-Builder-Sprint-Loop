import { mapModusignDocumentStatus } from './status-mapper';
import type { ModusignDocument } from './client';
import { canTransitionPledge } from '@/lib/pledges/status';
import type { PledgeStatus } from '@/lib/pledges/status';
import type { SupabaseClient } from '@supabase/supabase-js';

type StoredParticipant = {
  id?: string;
  provider_participant_id: string;
  role: 'donor' | 'organization';
  signed_at?: string | null;
  status: 'waiting' | 'signed' | 'declined';
};

type SnapshotSyncInput = {
  adminClient: SupabaseClient;
  currentPledgeStatus: PledgeStatus;
  documentId: string;
  eventId?: string;
  providerDocument: ModusignDocument;
  storedParticipants: StoredParticipant[];
};

export async function applyModusignSnapshot({
  adminClient,
  currentPledgeStatus,
  documentId,
  eventId,
  providerDocument,
  storedParticipants,
}: SnapshotSyncInput) {
  const signedIds = new Set(
    providerDocument.signings.map((signing) => signing.participantId),
  );
  const signedAtByParticipant = new Map(
    providerDocument.signings.map((signing) => [
      signing.participantId,
      signing.signedAt,
    ]),
  );
  const participants = (['donor', 'organization'] as const)
    .map((role) => {
      const storedParticipant = storedParticipants.find(
        (participant) => participant.role === role,
      );
      const providerParticipant = providerDocument.participants.find(
        (participant) =>
          participant.signingOrder === (role === 'donor' ? 1 : 2),
      );
      const providerParticipantId =
        storedParticipant?.provider_participant_id || providerParticipant?.id;

      if (!providerParticipantId) {
        return null;
      }

      const providerParticipantStatus =
        providerParticipant?.status?.toUpperCase() || '';
      const isDeclined =
        providerParticipantStatus.includes('DECLIN') ||
        providerParticipantStatus.includes('REJECT');

      return {
        provider_participant_id: providerParticipantId,
        role,
        signing_order: role === 'donor' ? 1 : 2,
        signed_at:
          signedAtByParticipant.get(providerParticipantId) ||
          storedParticipant?.signed_at ||
          null,
        status: signedIds.has(providerParticipantId)
          ? ('signed' as const)
          : isDeclined || storedParticipant?.status === 'declined'
            ? ('declined' as const)
            : ('waiting' as const),
      };
    })
    .filter((participant): participant is NonNullable<typeof participant> =>
      Boolean(participant),
    );
  const nextStatus = mapModusignDocumentStatus(
    {
      abortType: providerDocument.abortType,
      currentSigningOrder: providerDocument.currentSigningOrder,
      participants: participants.map((participant) => ({
        role: participant.role,
        status: participant.status,
      })),
      status: providerDocument.status,
    },
    currentPledgeStatus,
  );

  if (!canTransitionPledge(currentPledgeStatus, nextStatus)) {
    throw new Error('invalid_provider_transition');
  }

  const { error } = await adminClient.rpc('apply_modusign_snapshot', {
    p_next_pledge_status: nextStatus,
    p_participants: participants,
    p_provider_document_id: providerDocument.id,
    p_provider_event_id: eventId || null,
    p_provider_status: providerDocument.status,
    p_signature_document_id: documentId,
  });

  if (error) {
    throw new Error(error.message || 'snapshot_sync_failed');
  }

  return nextStatus;
}
