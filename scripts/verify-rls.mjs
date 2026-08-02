import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

const required = [
  ['NEXT_PUBLIC_SUPABASE_URL', url],
  [
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    anonKey,
  ],
  ['DEMO_DONOR_EMAIL', process.env.DEMO_DONOR_EMAIL],
  ['DEMO_DONOR_PASSWORD', process.env.DEMO_DONOR_PASSWORD],
  ['DEMO_ORGANIZATION_EMAIL', process.env.DEMO_ORGANIZATION_EMAIL],
  ['DEMO_ORGANIZATION_PASSWORD', process.env.DEMO_ORGANIZATION_PASSWORD],
  ['DEMO_ORGANIZATION_SLUG', process.env.DEMO_ORGANIZATION_SLUG],
];

const missing = required
  .filter(([, value]) => !value?.trim())
  .map(([name]) => name);
if (missing.length) {
  console.error(`RLS 검증에 필요한 환경변수가 없습니다: ${missing.join(', ')}`);
  process.exit(1);
}

const targetPledgeId = process.env.RLS_PLEDGE_ID?.trim() || null;
const baseClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
const pass = (name) => results.push({ name, ok: true });
const fail = (name, detail) => results.push({ detail, name, ok: false });

const { data: organization, error: organizationError } = await baseClient
  .from('organizations')
  .select('id')
  .eq('slug', process.env.DEMO_ORGANIZATION_SLUG.trim())
  .maybeSingle();

if (organizationError || !organization) {
  fail('공개 조직 조회', organizationError?.message || '조직이 없습니다.');
} else {
  pass('공개 조직 조회');
}

const donor = await signIn(
  '기부자',
  process.env.DEMO_DONOR_EMAIL,
  process.env.DEMO_DONOR_PASSWORD,
);
const signer = await signIn(
  '기부처 signer',
  process.env.DEMO_ORGANIZATION_EMAIL,
  process.env.DEMO_ORGANIZATION_PASSWORD,
);
const viewer = await signInOptional(
  '기부처 viewer',
  process.env.RLS_VIEWER_EMAIL,
  process.env.RLS_VIEWER_PASSWORD,
);
const otherOrganizationUser = await signInOptional(
  '다른 조직 사용자',
  process.env.RLS_OTHER_ORGANIZATION_EMAIL,
  process.env.RLS_OTHER_ORGANIZATION_PASSWORD,
);

let pledgeId = targetPledgeId;
if (donor) {
  const donorQuery = donor.client
    .from('pledges')
    .select('id, organization_id, donor_user_id')
    .eq('donor_user_id', donor.user.id);
  if (targetPledgeId) donorQuery.eq('id', targetPledgeId);
  const { data, error } = await donorQuery;
  if (error) {
    fail('기부자 본인 약정 조회', error.message);
  } else if (
    (data || []).some((pledge) => pledge.donor_user_id !== donor.user.id)
  ) {
    fail('기부자 본인 약정 조회', '타 사용자 약정이 반환되었습니다.');
  } else if (!data?.length) {
    fail(
      '기부자 본인 약정 조회',
      '검증할 약정이 없습니다. RLS_PLEDGE_ID를 설정하세요.',
    );
  } else {
    pledgeId ||= data[0].id;
    pass('기부자 본인 약정 조회');
  }
}

if (signer && organization) {
  const { data: memberships, error: membershipError } = await signer.client
    .from('organization_members')
    .select('organization_id, role')
    .eq('organization_id', organization.id)
    .eq('user_id', signer.user.id);
  if (membershipError) {
    fail('기부처 signer membership 조회', membershipError.message);
  } else if (
    !memberships?.some((membership) =>
      ['owner', 'signer'].includes(membership.role),
    )
  ) {
    fail(
      '기부처 signer membership 조회',
      'owner/signer membership이 없습니다.',
    );
  } else {
    pass('기부처 signer membership 조회');
  }
}

if (signer && organization && pledgeId) {
  const { data, error } = await signer.client
    .from('pledges')
    .select('id, organization_id')
    .eq('id', pledgeId)
    .eq('organization_id', organization.id);
  if (error || data?.length !== 1) {
    fail(
      '기부처 signer 소속 약정 조회',
      error?.message || '소속 약정이 반환되지 않았습니다.',
    );
  } else {
    pass('기부처 signer 소속 약정 조회');
  }
}

if (viewer && organization && pledgeId) {
  const { data, error } = await viewer.client
    .from('pledges')
    .select('id, organization_id')
    .eq('id', pledgeId)
    .eq('organization_id', organization.id);
  if (error || data?.length !== 1) {
    fail(
      '기부처 viewer 소속 약정 조회',
      error?.message || 'viewer에게 소속 약정이 반환되지 않았습니다.',
    );
  } else {
    pass('기부처 viewer 소속 약정 조회');
  }
}

if (otherOrganizationUser && pledgeId) {
  const { data, error } = await otherOrganizationUser.client
    .from('pledges')
    .select('id')
    .eq('id', pledgeId);
  if (error) {
    fail('다른 조직 사용자 약정 접근 차단', error.message);
  } else if (data?.length) {
    fail('다른 조직 사용자 약정 접근 차단', '타 조직 약정이 반환되었습니다.');
  } else {
    pass('다른 조직 사용자 약정 접근 차단');
  }
}

if (pledgeId) {
  const { data, error } = await baseClient
    .from('pledges')
    .select('id')
    .eq('id', pledgeId);
  if (error) {
    fail('익명 약정 접근 차단', error.message);
  } else if (data?.length) {
    fail('익명 약정 접근 차단', '익명 사용자에게 약정이 반환되었습니다.');
  } else {
    pass('익명 약정 접근 차단');
  }
}

const failures = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(
    `${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? `: ${result.detail}` : ''}`,
  );
}

if (failures.length) process.exit(1);

async function signIn(label, email, password) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    fail(`${label} 로그인`, error?.message || '사용자가 없습니다.');
    return null;
  }
  pass(`${label} 로그인`);
  return { client, user: data.user };
}

async function signInOptional(label, email, password) {
  if (!email && !password) return null;
  if (!email || !password) {
    fail(`${label} 로그인`, '이메일과 비밀번호를 함께 설정해야 합니다.');
    return null;
  }
  return signIn(label, email, password);
}
