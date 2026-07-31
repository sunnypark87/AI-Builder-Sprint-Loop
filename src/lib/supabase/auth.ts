import type { User } from '@supabase/supabase-js';

import { createClient } from './server';

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
