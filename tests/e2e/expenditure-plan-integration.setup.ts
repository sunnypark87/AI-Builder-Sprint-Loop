import { createClient } from '@supabase/supabase-js';

export const integrationIds = {
  organization: '77777777-7777-4777-8777-777777777777',
  donation: '77777777-0000-4000-8000-000000000001',
};

export const integrationUser = {
  email: 'plan-manager@example.test',
  password: 'Plan-test-2026!',
};

export default async function setup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      'Local Supabase URL and SUPABASE_TEST_SECRET_KEY are required.',
    );
  }

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: plansError } = await supabase
    .from('expenditure_plans')
    .delete()
    .eq('organization_id', integrationIds.organization);
  if (plansError) throw plansError;

  const { data: users, error: usersError } =
    await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;

  const existing = users.users.find(
    (user) => user.email === integrationUser.email,
  );
  if (existing) {
    const { error } = await supabase.auth.admin.deleteUser(existing.id);
    if (error) throw error;
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: integrationUser.email,
      password: integrationUser.password,
      email_confirm: true,
    });
  if (createError || !created.user) {
    throw createError ?? new Error('Integration user was not created.');
  }

  const { error: organizationError } = await supabase
    .from('organizations')
    .upsert({ id: integrationIds.organization, name: '통합 테스트 기부처' });
  if (organizationError) throw organizationError;

  const { error: donationError } = await supabase.from('donations').upsert({
    id: integrationIds.donation,
    organization_id: integrationIds.organization,
    amount: 100_000,
  });
  if (donationError) throw donationError;

  const { error: memberError } = await supabase
    .from('organization_members')
    .upsert({
      organization_id: integrationIds.organization,
      user_id: created.user.id,
      role: 'manager',
    });
  if (memberError) throw memberError;
}
