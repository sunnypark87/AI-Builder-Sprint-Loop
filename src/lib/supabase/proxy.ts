import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { getSupabasePublishableKey, getSupabaseUrl } from './config';

/**
 * Refreshes the Supabase Auth session and forwards refreshed cookies to both
 * the current request and the browser response.
 *
 * Authorization decisions belong in server-side page or route code. Proxy is
 * intentionally limited to keeping the cookie-based session current.
 */
export async function updateSession(request: NextRequest) {
  request.headers.set(
    'x-modugive-pathname',
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      getSupabaseUrl(),
      getSupabasePublishableKey(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });

            supabaseResponse = NextResponse.next({ request });

            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    // getClaims validates the token and lets @supabase/ssr refresh it when
    // needed. The result is not used as an authorization decision here.
    await supabase.auth.getClaims();
  } catch {
    // Public routes should remain renderable when Supabase is unavailable.
    // Server-side protected resources must handle Auth errors independently.
  }

  return supabaseResponse;
}
