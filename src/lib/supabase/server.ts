import { createServerClient } from '@supabase/ssr';
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import {
  getSupabasePublishableKey,
  getSupabaseSecretKey,
  getSupabaseUrl,
} from './config';

export { SupabaseConfigurationError } from './config';

export async function createClient(): Promise<SupabaseClient> {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Proxy handles refreshes.
        }
      },
    },
  });
}

export function createServiceClient(): SupabaseClient {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
