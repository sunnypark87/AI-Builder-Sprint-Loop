import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, getUser } = vi.hoisted(() => {
  const getUser = vi.fn();
  const createClient = vi.fn(async () => ({ auth: { getUser } }));

  return { createClient, getUser };
});

vi.mock('@/lib/supabase/server', () => ({ createClient }));

import { GET } from './route';

describe('GET /api/health/supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a healthy unauthenticated connection', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthSessionMissingError' },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      authenticated: false,
    });
  });

  it('reports an authenticated connection without returning user data', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'private@example.com' } },
      error: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok', authenticated: true });
    expect(body).not.toHaveProperty('user');
  });

  it('hides Auth failures behind a generic unavailable response', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'FetchError', message: 'private upstream details' },
    });

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      code: 'supabase_auth_unavailable',
    });
  });

  it('handles unexpected client failures without leaking details', async () => {
    createClient.mockRejectedValueOnce(
      new Error('private configuration details'),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'error',
      code: 'supabase_auth_unavailable',
    });
  });
});
