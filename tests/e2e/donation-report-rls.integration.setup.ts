import { createClient } from '@supabase/supabase-js';

export const reportRlsIds = {
  organization: '18181818-1818-4818-8818-181818181818',
  reviewPledge: '18181818-0000-4000-8000-000000000001',
  publishedPledge: '18181818-0000-4000-8000-000000000002',
  reviewDonation: '18181818-0000-4000-8000-000000000011',
  publishedDonation: '18181818-0000-4000-8000-000000000012',
  reviewPlan: '18181818-0000-4000-8000-000000000021',
  publishedPlan: '18181818-0000-4000-8000-000000000022',
  reviewReport: '18181818-0000-4000-8000-000000000031',
  publishedReport: '18181818-0000-4000-8000-000000000032',
};

export const reportRlsUsers = {
  manager: {
    email: 'report-manager@example.test',
    password: 'Report-manager-2026!',
  },
  donor: {
    email: 'report-donor@example.test',
    password: 'Report-donor-2026!',
  },
  outsider: {
    email: 'report-outsider@example.test',
    password: 'Report-outsider-2026!',
  },
};

export default async function setup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error('Local Supabase test environment is missing.');
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: reportDeleteError } = await admin
    .from('donation_reports')
    .delete()
    .eq('organization_id', reportRlsIds.organization);
  if (reportDeleteError) throw reportDeleteError;
  const { error: planDeleteError } = await admin
    .from('expenditure_plans')
    .delete()
    .eq('organization_id', reportRlsIds.organization);
  if (planDeleteError) throw planDeleteError;
  const { error: donationDeleteError } = await admin
    .from('donations')
    .delete()
    .eq('organization_id', reportRlsIds.organization);
  if (donationDeleteError) throw donationDeleteError;
  const { error: pledgeDeleteError } = await admin
    .from('pledges')
    .delete()
    .eq('organization_id', reportRlsIds.organization);
  if (pledgeDeleteError) throw pledgeDeleteError;

  const { data: existingUsers, error: listError } =
    await admin.auth.admin.listUsers();
  if (listError) throw listError;
  for (const account of Object.values(reportRlsUsers)) {
    const existing = existingUsers.users.find(
      (user) => user.email === account.email,
    );
    if (existing) {
      const { error } = await admin.auth.admin.deleteUser(existing.id);
      if (error) throw error;
    }
  }

  const userIds: Record<keyof typeof reportRlsUsers, string> = {
    manager: '',
    donor: '',
    outsider: '',
  };
  for (const [role, account] of Object.entries(reportRlsUsers) as Array<
    [keyof typeof reportRlsUsers, (typeof reportRlsUsers)['manager']]
  >) {
    const { data, error } = await admin.auth.admin.createUser({
      ...account,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error('User creation failed.');
    userIds[role] = data.user.id;
  }

  const { error: organizationError } = await admin
    .from('organizations')
    .upsert({
      id: reportRlsIds.organization,
      slug: 'report-rls-integration',
      name: '보고서 RLS 통합 테스트 기관',
      is_public: false,
    });
  if (organizationError) throw organizationError;
  const { error: memberError } = await admin
    .from('organization_members')
    .upsert({
      organization_id: reportRlsIds.organization,
      user_id: userIds.manager,
      role: 'manager',
    });
  if (memberError) throw memberError;

  const pledgeBase = {
    donor_user_id: userIds.donor,
    organization_id: reportRlsIds.organization,
    status: 'signed',
    amount: 100_000,
    donation_type: '일시 기부',
    purpose: '아동 급식 지원',
    pledge_date: '2026-08-01',
    allocation_start_date: '2026-08-01',
    allocation_end_date: '2026-08-31',
    donor_name: '테스트 기부자',
    donor_address: '비공개 주소',
    donor_contact: '010-0000-0000',
  };
  const { error: pledgeError } = await admin.from('pledges').insert([
    { ...pledgeBase, id: reportRlsIds.reviewPledge },
    { ...pledgeBase, id: reportRlsIds.publishedPledge },
  ]);
  if (pledgeError) throw pledgeError;
  const { error: donationError } = await admin.from('donations').insert([
    {
      id: reportRlsIds.reviewDonation,
      organization_id: reportRlsIds.organization,
      pledge_id: reportRlsIds.reviewPledge,
      amount: 100_000,
      status: 'paid',
    },
    {
      id: reportRlsIds.publishedDonation,
      organization_id: reportRlsIds.organization,
      pledge_id: reportRlsIds.publishedPledge,
      amount: 100_000,
      status: 'paid',
    },
  ]);
  if (donationError) throw donationError;

  const planBase = {
    organization_id: reportRlsIds.organization,
    created_by: userIds.manager,
    status: 'registered',
    input_method: 'manual',
    title: '8월 급식 집행 계획',
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    total_amount: 100_000,
  };
  const { error: planError } = await admin.from('expenditure_plans').insert([
    {
      ...planBase,
      id: reportRlsIds.reviewPlan,
      donation_id: reportRlsIds.reviewDonation,
      idempotency_key: 'report-rls-review-plan',
    },
    {
      ...planBase,
      id: reportRlsIds.publishedPlan,
      donation_id: reportRlsIds.publishedDonation,
      idempotency_key: 'report-rls-published-plan',
    },
  ]);
  if (planError) throw planError;

  const content = {
    title: '8월 기부 집행 보고',
    summary: '검증된 집행 내역을 요약했습니다.',
    comparison: '계획과 집행 내역을 비교했습니다.',
    itemNarratives: [],
    outcomes: [],
    nextSteps: [],
    evidenceIds: [],
  };
  const reportBase = {
    organization_id: reportRlsIds.organization,
    created_by: userIds.manager,
    title: '8월 기부 집행 보고',
    period_start: '2026-08-01',
    period_end: '2026-08-31',
    evidence_snapshot: { version: 1 },
  };
  const { error: reportError } = await admin.from('donation_reports').insert([
    {
      ...reportBase,
      id: reportRlsIds.reviewReport,
      donation_id: reportRlsIds.reviewDonation,
      pledge_id: reportRlsIds.reviewPledge,
      plan_id: reportRlsIds.reviewPlan,
      status: 'review_required',
      idempotency_key: 'report-rls-review-report',
      draft_content: content,
    },
    {
      ...reportBase,
      id: reportRlsIds.publishedReport,
      donation_id: reportRlsIds.publishedDonation,
      pledge_id: reportRlsIds.publishedPledge,
      plan_id: reportRlsIds.publishedPlan,
      status: 'published',
      idempotency_key: 'report-rls-published-report',
      published_content: content,
      published_at: new Date().toISOString(),
    },
  ]);
  if (reportError) throw reportError;
}
