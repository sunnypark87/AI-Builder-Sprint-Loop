import type { SupabaseClient } from '@supabase/supabase-js';

export async function getActiveOrganizationMembership(
  supabase: SupabaseClient,
  userId: string,
) {
  return supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .order('organization_id', { ascending: true })
    .limit(1)
    .maybeSingle();
}
