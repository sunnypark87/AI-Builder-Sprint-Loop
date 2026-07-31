import { NextResponse } from 'next/server';

import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = getSupabaseUrl();
    const publishableKey = getSupabasePublishableKey();
    const upstreamResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      cache: 'no-store',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
    });

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { status: 'error', code: 'supabase_auth_unavailable' },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error && error.name !== 'AuthSessionMissingError') {
      return NextResponse.json(
        { status: 'error', code: 'supabase_auth_unavailable' },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: 'ok',
      authenticated: Boolean(user),
    });
  } catch {
    return NextResponse.json(
      { status: 'error', code: 'supabase_auth_unavailable' },
      { status: 503 },
    );
  }
}
