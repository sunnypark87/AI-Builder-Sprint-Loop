import type { SupabaseClient } from '@supabase/supabase-js';

export async function getOrganizationMemberships(
  supabase: SupabaseClient,
  userId: string,
) {
  return supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .order('organization_id', { ascending: true });
}

export async function getOrganizationIds(
  supabase: SupabaseClient,
  userId: string,
) {
  const result = await getOrganizationMemberships(supabase, userId);
  return {
    ...result,
    data: (result.data ?? []).map((membership) => membership.organization_id),
  };
}
