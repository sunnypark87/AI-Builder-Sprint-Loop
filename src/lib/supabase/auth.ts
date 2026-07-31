import type { User } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

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

export async function requireCurrentUser(fallbackPath: string) {
  const user = await getCurrentUser();
  if (user) return user;

  const requestPath =
    (await headers()).get('x-modugive-pathname') ?? fallbackPath;
  const safePath =
    requestPath.startsWith('/') && !requestPath.startsWith('//')
      ? requestPath
      : fallbackPath;
  redirect(`/login?next=${encodeURIComponent(safePath)}`);
}
