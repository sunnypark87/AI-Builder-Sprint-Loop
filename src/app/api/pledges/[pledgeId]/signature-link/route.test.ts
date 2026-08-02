import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const {
  createAdminClient,
  createClient,
  createModusignClient,
  getCurrentUser,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  createModusignClient: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/modusign/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modusign/client')>()),
  createModusignClient,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }));
vi.mock('@/lib/supabase/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

const context = { params: Promise.resolve({ pledgeId: 'pledge-1' }) };

function userClient({
  membership = null,
  pledge = {
    donor_user_id: 'donor-1',
    id: 'pledge-1',
    organization_id: 'org-1',
    status: 'awaiting_donor_signature',
  },
} = {}) {
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
                  data: pledge,
                  error: null,
                }),
              }),
            }),
          },
    ),
  };
}

function adminClient({
  participant = null,
  document = null,
}: {
  participant?: { provider_participant_id: string; status: string } | null;
  document?: { id: string; provider_document_id: string } | null;
} = {}) {
  return {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({
          ...(table === 'signature_participants'
            ? {
                eq: () => ({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: participant, error: null }),
                }),
              }
            : {
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: document, error: null }),
              }),
        }),
      }),
    })),
  };
}

describe('POST /api/pledges/[pledgeId]/signature-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({
      id: 'donor-1',
      email: 'donor@example.com',
    });
    createClient.mockResolvedValue(userClient());
    createAdminClient.mockReturnValue(
      adminClient({
        document: { id: 'document-1', provider_document_id: 'provider-1' },
        participant: {
          provider_participant_id: 'participant-1',
          status: 'waiting',
        },
      }),
    );
    createModusignClient.mockReturnValue({
      getEmbeddedParticipantView: vi.fn().mockResolvedValue({
        embeddedUrl: 'https://modusign.example/embed',
      }),
    });
  });

  it('rejects anonymous users', async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-link'),
      context,
    );

    expect(response.status).toBe(401);
  });

  it('rejects a donor who does not own the pledge', async () => {
    getCurrentUser.mockResolvedValue({
      id: 'other-user',
      email: 'other@example.com',
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-link'),
      context,
    );

    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('returns an embedded URL for an eligible donor', async () => {
    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-link'),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      embeddedUrl: 'https://modusign.example/embed',
    });
  });

  it('maps provider failures without exposing provider details', async () => {
    createModusignClient.mockReturnValue({
      getEmbeddedParticipantView: vi
        .fn()
        .mockRejectedValue(new Error('secret provider response')),
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/signature-link'),
      context,
    );

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ code: 'signature_link_failed' });
    expect(JSON.stringify(body)).not.toContain('secret provider response');
  });
});
