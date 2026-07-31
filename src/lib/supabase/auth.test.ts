import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, getUser } = vi.hoisted(() => {
  const getUser = vi.fn();
  const createClient = vi.fn(async () => ({ auth: { getUser } }));

  return { createClient, getUser };
});

vi.mock('./server', () => ({ createClient }));

import { getCurrentUser } from './auth';

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
});
