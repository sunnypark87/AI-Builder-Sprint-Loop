import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, getSession, onAuthStateChange, unsubscribe } = vi.hoisted(
  () => {
    const getSession = vi.fn();
    const unsubscribe = vi.fn();
    const onAuthStateChange = vi.fn(() => ({
      data: { subscription: { unsubscribe } },
    }));
    const createClient = vi.fn(() => ({
      auth: { getSession, onAuthStateChange },
    }));

    return { createClient, getSession, onAuthStateChange, unsubscribe };
  },
);

vi.mock('./client', () => ({ createClient }));

import { getCurrentSession, subscribeToAuthState } from './auth-client';

describe('browser auth state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current session for client-side UI state', async () => {
    const session = { access_token: 'access-token', user: { id: 'user-1' } };
    getSession.mockResolvedValue({ data: { session }, error: null });

    await expect(getCurrentSession()).resolves.toEqual(session);
  });

  it('returns null when the browser session lookup fails', async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('offline'),
    });

    await expect(getCurrentSession()).resolves.toBeNull();
  });

  it('forwards auth events and unsubscribes cleanly', () => {
    const callback = vi.fn();
    const unsubscribeFromAuth = subscribeToAuthState(callback);

    expect(onAuthStateChange).toHaveBeenCalledWith(callback);
    unsubscribeFromAuth();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
