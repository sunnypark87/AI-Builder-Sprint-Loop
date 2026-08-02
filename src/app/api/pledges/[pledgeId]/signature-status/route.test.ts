import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const { createClient, getCurrentUser } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/supabase/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

const context = { params: Promise.resolve({ pledgeId: 'pledge-1' }) };

function client({
  membership = null,
  pledge = null,
}: {
  membership?: { role: string } | null;
  pledge?: Record<string, string> | null;
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'organization_members') {
        return {
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
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: pledge, error: null }),
          }),
        }),
      };
    }),
  };
}

describe('GET /api/pledges/[pledgeId]/signature-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: 'user-1' });
    createClient.mockResolvedValue(
      client({
        pledge: {
          donor_user_id: 'user-1',
          id: 'pledge-1',
          organization_id: 'org-1',
          status: 'awaiting_donor_signature',
        },
      }),
    );
  });

  it('rejects anonymous requests and invalid roles', async () => {
    getCurrentUser.mockResolvedValueOnce(null);
    const anonymous = await GET(
      new Request(
        'http://localhost/api/pledges/pledge-1/signature-status?role=donor',
      ),
      context,
    );
    expect(anonymous.status).toBe(401);

    getCurrentUser.mockResolvedValueOnce({ id: 'user-1' });
    const invalid = await GET(
      new Request(
        'http://localhost/api/pledges/pledge-1/signature-status?role=other',
      ),
      context,
    );
    expect(invalid.status).toBe(400);
  });

  it('returns the persisted donor signature state', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/pledges/pledge-1/signature-status?role=donor',
      ),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'awaiting_donor_signature',
    });
  });

  it('requires an organization signer membership', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/pledges/pledge-1/signature-status?role=organization',
      ),
      context,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: 'forbidden' });
  });
});
