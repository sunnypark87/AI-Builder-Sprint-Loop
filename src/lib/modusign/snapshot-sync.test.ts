import { describe, expect, it, vi } from 'vitest';

import type { ModusignDocument } from './client';
import { applyModusignSnapshot } from './snapshot-sync';
import type { SupabaseClient } from '@supabase/supabase-js';

const baseDocument: ModusignDocument = {
  id: 'provider-document-1',
  participants: [
    {
      id: 'donor-participant-1',
      name: '테스트 기부자',
      signingOrder: 1,
      status: 'WAITING',
      type: 'SIGNER',
    },
    {
      id: 'organization-participant-1',
      name: '테스트 기부처',
      signingOrder: 2,
      status: 'WAITING',
      type: 'SIGNER',
    },
  ],
  signings: [],
  status: 'ON_GOING',
  title: '기부 약정서',
};

function adminClient() {
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

const storedParticipants = [
  {
    provider_participant_id: 'donor-participant-1',
    role: 'donor' as const,
    status: 'waiting' as const,
  },
  {
    provider_participant_id: 'organization-participant-1',
    role: 'organization' as const,
    status: 'waiting' as const,
  },
];

describe('applyModusignSnapshot', () => {
  it('advances to organization signing after the donor signs', async () => {
    const admin = adminClient();
    const providerDocument = {
      ...baseDocument,
      currentSigningOrder: 2,
      participants: baseDocument.participants.map((participant) =>
        participant.signingOrder === 1
          ? { ...participant, status: 'SIGNED' }
          : participant,
      ),
      signings: [
        {
          participantId: 'donor-participant-1',
          signedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    };

    await expect(
      applyModusignSnapshot({
        adminClient: admin as unknown as SupabaseClient,
        currentPledgeStatus: 'awaiting_donor_signature',
        documentId: 'document-1',
        providerDocument,
        storedParticipants,
      }),
    ).resolves.toBe('awaiting_organization_signature');

    expect(admin.rpc).toHaveBeenCalledWith(
      'apply_modusign_snapshot',
      expect.objectContaining({
        p_next_pledge_status: 'awaiting_organization_signature',
        p_participants: expect.arrayContaining([
          expect.objectContaining({ role: 'donor', status: 'signed' }),
        ]),
      }),
    );
  });

  it('marks the pledge signed only after both participants sign', async () => {
    const admin = adminClient();
    const providerDocument = {
      ...baseDocument,
      currentSigningOrder: undefined,
      signings: [
        {
          participantId: 'donor-participant-1',
          signedAt: '2026-08-02T00:00:00.000Z',
        },
        {
          participantId: 'organization-participant-1',
          signedAt: '2026-08-02T00:01:00.000Z',
        },
      ],
      status: 'COMPLETED',
    };

    await expect(
      applyModusignSnapshot({
        adminClient: admin as unknown as SupabaseClient,
        currentPledgeStatus: 'awaiting_organization_signature',
        documentId: 'document-1',
        providerDocument,
        storedParticipants,
      }),
    ).resolves.toBe('signed');
  });

  it('does not allow a signed participant to regress to waiting', async () => {
    const admin = adminClient();
    const providerDocument = {
      ...baseDocument,
      status: 'ON_GOING',
    };

    await expect(
      applyModusignSnapshot({
        adminClient: admin as unknown as SupabaseClient,
        currentPledgeStatus: 'awaiting_organization_signature',
        documentId: 'document-1',
        providerDocument,
        storedParticipants: storedParticipants.map((participant) =>
          participant.role === 'donor'
            ? {
                ...participant,
                signed_at: '2026-08-02T00:00:00.000Z',
                status: 'signed' as const,
              }
            : participant,
        ),
      }),
    ).rejects.toThrow('invalid_provider_transition');
  });

  it('surfaces snapshot persistence failures', async () => {
    const admin = adminClient();
    admin.rpc.mockResolvedValue({
      data: null,
      error: { message: 'snapshot failure' },
    });

    await expect(
      applyModusignSnapshot({
        adminClient: admin as unknown as SupabaseClient,
        currentPledgeStatus: 'awaiting_donor_signature',
        documentId: 'document-1',
        providerDocument: baseDocument,
        storedParticipants,
      }),
    ).rejects.toThrow('snapshot failure');
  });
});
