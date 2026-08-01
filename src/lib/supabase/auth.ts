import type { SupabaseClient, User } from '@supabase/supabase-js';

import { createClient } from './server';

export class AuthenticationError extends Error {
  constructor() {
    super('로그인이 필요합니다.');
    this.name = 'AuthenticationError';
  }
}

export async function requireUserId(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthenticationError();
  }

  return user.id;
}

/**
 * Returns the user confirmed by Supabase Auth, or null for an absent or
 * invalid session. Callers must not use the raw session user for authorization.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}
