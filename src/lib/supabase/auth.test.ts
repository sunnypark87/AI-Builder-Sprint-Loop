import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, getUser } = vi.hoisted(() => {
  const getUser = vi.fn();
  const createClient = vi.fn(async () => ({ auth: { getUser } }));

  return { createClient, getUser };
});

vi.mock('./server', () => ({ createClient }));

import { AuthenticationError, getCurrentUser, requireUserId } from './auth';

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

describe('requireUserId', () => {
  it('returns the server-validated user id', async () => {
    const auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    };

    await expect(
      requireUserId({ auth } as unknown as Parameters<typeof requireUserId>[0]),
    ).resolves.toBe('user-1');
  });

  it('rejects an absent or invalid session', async () => {
    const auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('private auth detail'),
      }),
    };

    await expect(
      requireUserId({ auth } as unknown as Parameters<typeof requireUserId>[0]),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
