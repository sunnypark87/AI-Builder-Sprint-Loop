'use client';

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { createClient } from './client';

/** Returns the browser session for displaying client-side auth state. */
export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
    error,
  } = await createClient().auth.getSession();

  return error ? null : session;
}

/**
 * Subscribes to browser auth changes and returns a safe unsubscribe function.
 * The callback is intended for UI state only, not authorization decisions.
 */
export function subscribeToAuthState(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const {
    data: { subscription },
  } = createClient().auth.onAuthStateChange(callback);

  return () => subscription.unsubscribe();
}
