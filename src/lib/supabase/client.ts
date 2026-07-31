'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabasePublishableKey, getSupabaseUrl } from './config';

let browserClient: SupabaseClient | undefined;

export function createClient() {
  browserClient ??= createBrowserClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
  );

  return browserClient;
}
