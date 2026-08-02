import { createClient } from '@supabase/supabase-js';

export const executionIntegrationIds = {
  organization: '97777777-7777-4777-8777-777777777777',
  donation: '97777777-0000-4000-8000-000000000001',
  plan: '97777777-1000-4000-8000-000000000001',
  planItem: '97777777-2000-4000-8000-000000000001',
};

export const executionIntegrationUser = {
  email: 'execution-manager@example.test',
  password: 'Execution-test-2026!',
};

export default async function setup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error('Local Supabase test environment is required.');
  }
  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await supabase
    .from('expenditure_executions')
    .delete()
    .eq('organization_id', executionIntegrationIds.organization);
  await supabase
    .from('expenditure_plans')
    .delete()
    .eq('organization_id', executionIntegrationIds.organization);

  const { data: users, error: usersError } =
    await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;
  const existing = users.users.find(
    (user) => user.email === executionIntegrationUser.email,
  );
  if (existing) {
    const { error } = await supabase.auth.admin.deleteUser(existing.id);
    if (error) throw error;
  }
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: executionIntegrationUser.email,
      password: executionIntegrationUser.password,
      email_confirm: true,
    });
  if (createError || !created.user) throw createError;

  const { error: organizationError } = await supabase
    .from('organizations')
    .upsert({
      id: executionIntegrationIds.organization,
      name: '집행 통합 테스트 기부처',
    });
  if (organizationError) throw organizationError;
  const { error: memberError } = await supabase
    .from('organization_members')
    .upsert({
      organization_id: executionIntegrationIds.organization,
      user_id: created.user.id,
      role: 'manager',
    });
  if (memberError) throw memberError;
  const { error: donationError } = await supabase.from('donations').upsert({
    id: executionIntegrationIds.donation,
    organization_id: executionIntegrationIds.organization,
    amount: 200_000,
    status: 'paid',
    paid_at: '2026-07-31T00:00:00Z',
    paid_at_is_authoritative: true,
  });
  if (donationError) throw donationError;
  const { error: planError } = await supabase.from('expenditure_plans').insert({
    id: executionIntegrationIds.plan,
    organization_id: executionIntegrationIds.organization,
    donation_id: executionIntegrationIds.donation,
    created_by: created.user.id,
    reviewed_by: created.user.id,
    status: 'registered',
    title: '8월 급식 계획',
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    total_amount: 200_000,
    source_file_name: 'plan.png',
    source_mime_type: 'image/png',
    source_size_bytes: 100,
    source_page_count: 1,
    source_fingerprint: '9'.repeat(64),
    idempotency_key: 'execution-integration-plan',
    reviewed_at: new Date().toISOString(),
  });
  if (planError) throw planError;
  const { error: itemError } = await supabase
    .from('expenditure_plan_items')
    .insert({
      id: executionIntegrationIds.planItem,
      plan_id: executionIntegrationIds.plan,
      name: '식재료',
      description: '',
      amount: 200_000,
      sort_order: 0,
    });
  if (itemError) throw itemError;
}
