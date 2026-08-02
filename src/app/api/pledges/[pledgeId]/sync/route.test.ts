import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const {
  applyModusignSnapshot,
  createAdminClient,
  createClient,
  createModusignClient,
  getCurrentUser,
} = vi.hoisted(() => ({
  applyModusignSnapshot: vi.fn(),
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  createModusignClient: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/modusign/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modusign/client')>()),
  createModusignClient,
}));
vi.mock('@/lib/modusign/snapshot-sync', () => ({ applyModusignSnapshot }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }));
vi.mock('@/lib/supabase/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

const context = { params: Promise.resolve({ pledgeId: 'pledge-1' }) };

function userClient({ membership = null } = {}) {
  return {
    from: vi.fn((table: string) =>
      table === 'organization_members'
        ? {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: membership,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    donor_user_id: 'donor-1',
                    id: 'pledge-1',
                    organization_id: 'org-1',
                    status: 'awaiting_donor_signature',
                  },
                  error: null,
                }),
              }),
            }),
          },
    ),
  };
}

function successfulAdminClient() {
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));
  return {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () =>
          table === 'signature_participants'
            ? Promise.resolve({
                data: [
                  {
                    id: 'participant-1',
                    provider_participant_id: 'provider-participant-1',
                    role: 'donor',
                    signed_at: null,
                    status: 'waiting',
                  },
                ],
                error: null,
              })
            : {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'document-1',
                    last_synced_at: null,
                    provider_document_id: 'provider-1',
                  },
                  error: null,
                }),
              },
      }),
      update,
    })),
  };
}

describe('POST /api/pledges/[pledgeId]/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({
      id: 'donor-1',
      email: 'donor@example.com',
    });
    createClient.mockResolvedValue(userClient());
    createAdminClient.mockReturnValue(successfulAdminClient());
    createModusignClient.mockReturnValue({
      getDocument: vi.fn().mockResolvedValue({
        id: 'provider-1',
        participants: [],
        signings: [],
        status: 'WAITING',
        title: 'pledge',
      }),
    });
    applyModusignSnapshot.mockResolvedValue('awaiting_donor_signature');
  });

  it('rejects anonymous requests', async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/sync'),
      context,
    );

    expect(response.status).toBe(401);
  });

  it('rejects organization sync without signer membership', async () => {
    createClient.mockResolvedValue(userClient());

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/sync', {
        body: JSON.stringify({ role: 'organization' }),
        method: 'POST',
      }),
      context,
    );

    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('syncs the provider snapshot for an eligible donor', async () => {
    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/sync', {
        body: JSON.stringify({ role: 'donor' }),
        method: 'POST',
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'awaiting_donor_signature',
    });
    expect(applyModusignSnapshot).toHaveBeenCalledOnce();
  });

  it('returns a safe upstream error and marks sync failed', async () => {
    createModusignClient.mockReturnValue({
      getDocument: vi.fn().mockRejectedValue(new Error('provider secret')),
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/sync', {
        method: 'POST',
      }),
      context,
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: 'signature_sync_failed',
    });
  });
});
