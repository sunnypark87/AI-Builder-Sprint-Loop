import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const { createClient, createAdminClient, getCurrentUser } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/supabase/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

const context = { params: Promise.resolve({ pledgeId: 'pledge-1' }) };

function pledgeClient(status = 'signed') {
  return {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { donor_user_id: 'user-1', id: 'pledge-1', status },
              error: null,
            }),
          }),
        }),
      }),
    })),
  };
}

describe('POST /api/pledges/[pledgeId]/demo-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: 'user-1' });
    createClient.mockResolvedValue(pledgeClient());
  });

  it('rejects anonymous requests', async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/demo-payment', {
        body: JSON.stringify({ method: 'card', status: 'completed' }),
        method: 'POST',
      }),
      context,
    );

    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not allow payment before both signatures', async () => {
    createClient.mockResolvedValue(pledgeClient('awaiting_donor_signature'));

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/demo-payment', {
        body: JSON.stringify({ method: 'card', status: 'completed' }),
        method: 'POST',
      }),
      context,
    );

    expect(response.status).toBe(409);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('stores a terminal demo payment and returns the saved record', async () => {
    const payment = {
      id: 'payment-1',
      idempotency_key: 'pledge:pledge-1:demo-payment',
      method: 'card',
      pledge_id: 'pledge-1',
      status: 'completed',
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const insertMaybeSingle = vi.fn().mockResolvedValue({
      data: payment,
      error: null,
    });
    createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
        insert: () => ({
          select: () => ({ maybeSingle: insertMaybeSingle }),
        }),
      })),
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/demo-payment', {
        body: JSON.stringify({ method: 'card', status: 'completed' }),
        method: 'POST',
      }),
      context,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ payment });
    expect(insertMaybeSingle).toHaveBeenCalledOnce();
  });

  it('returns the existing payment on a repeated submission', async () => {
    const payment = {
      id: 'payment-1',
      method: 'card',
      pledge_id: 'pledge-1',
      status: 'completed',
    };
    createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: payment, error: null }),
          }),
        }),
      })),
    });

    const response = await POST(
      new Request('http://localhost/api/pledges/pledge-1/demo-payment', {
        body: JSON.stringify({ method: 'transfer', status: 'failed' }),
        method: 'POST',
      }),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      idempotent: true,
      payment,
    });
  });
});
