import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseUrl } from './config';

export function createAdminClient(): SupabaseClient {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    throw new Error('Supabase 서버 관리자 키가 설정되지 않았습니다.');
  }

  return createSupabaseClient(getSupabaseUrl(), secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
