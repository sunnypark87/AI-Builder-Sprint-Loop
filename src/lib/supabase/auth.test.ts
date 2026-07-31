import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, getUser } = vi.hoisted(() => {
  const getUser = vi.fn();
  const createClient = vi.fn(async () => ({ auth: { getUser } }));

  return { createClient, getUser };
});

vi.mock('./server', () => ({ createClient }));

const { requestHeaders, redirect } = vi.hoisted(() => ({
  requestHeaders: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock('next/headers', () => ({ headers: requestHeaders }));
vi.mock('next/navigation', () => ({ redirect }));

import { getCurrentUser, requireCurrentUser } from './auth';

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the user confirmed by Supabase Auth', async () => {
    const user = { id: 'user-1', email: 'donor@example.com' };
    getUser.mockResolvedValue({ data: { user }, error: null });

    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(createClient).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledOnce();
  });

  it('returns null when no session is present', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null when Supabase cannot validate the session', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid or expired session'),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('redirects unauthenticated users to login with a safe internal path', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    requestHeaders.mockResolvedValue(
      new Headers({ 'x-modugive-pathname': '/partner/register' }),
    );

    await expect(requireCurrentUser('/partner')).rejects.toThrow(
      'REDIRECT:/login?next=%2Fpartner%2Fregister',
    );
    expect(redirect).toHaveBeenCalledWith('/login?next=%2Fpartner%2Fregister');
  });
});
