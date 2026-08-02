import { createClient } from '@supabase/supabase-js';

const requiredEnvironment = [
  'DEMO_DONOR_EMAIL',
  'DEMO_DONOR_PASSWORD',
  'DEMO_ORGANIZATION_EMAIL',
  'DEMO_ORGANIZATION_PASSWORD',
  'DEMO_ORGANIZATION_SIGNER_NAME',
];

for (const name of requiredEnvironment) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name}가 설정되지 않았습니다.`);
  }
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase URL과 서버 관리자 키가 필요합니다.');
}

const donorEmail = process.env.DEMO_DONOR_EMAIL.trim().toLowerCase();
const organizationEmail =
  process.env.DEMO_ORGANIZATION_EMAIL.trim().toLowerCase();

if (donorEmail === organizationEmail) {
  throw new Error('기부자와 기부처 데모 이메일은 서로 달라야 합니다.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const donor = await ensureDemoUser(donorEmail, process.env.DEMO_DONOR_PASSWORD);
const organizationUser = await ensureDemoUser(
  organizationEmail,
  process.env.DEMO_ORGANIZATION_PASSWORD,
);
const organizationSlug = process.env.DEMO_ORGANIZATION_SLUG?.trim() || 'haebom';
const { data: organization, error: organizationError } = await admin
  .from('organizations')
  .select('id')
  .eq('slug', organizationSlug)
  .maybeSingle();

if (organizationError || !organization) {
  throw new Error(
    '지정한 데모 기부처를 찾지 못했습니다. seed를 먼저 적용하세요.',
  );
}

const { error: clearPrimaryError } = await admin
  .from('organization_members')
  .update({ is_primary_signer: false })
  .eq('organization_id', organization.id)
  .eq('is_primary_signer', true)
  .neq('user_id', organizationUser.id);

if (clearPrimaryError) {
  throw new Error('기존 대표 서명자 설정을 갱신하지 못했습니다.');
}

const { error: membershipError } = await admin
  .from('organization_members')
  .upsert(
    {
      is_primary_signer: true,
      organization_id: organization.id,
      role: 'signer',
      signer_email: organizationEmail,
      signer_name: process.env.DEMO_ORGANIZATION_SIGNER_NAME.trim(),
      user_id: organizationUser.id,
    },
    { onConflict: 'organization_id,user_id' },
  );

if (membershipError) {
  throw new Error('기부처 데모 계정의 조직 membership을 저장하지 못했습니다.');
}

console.log('데모 기부자 계정과 기부처 대표 서명자 연결을 확인했습니다.');
console.log(`기부처 slug: ${organizationSlug}`);
console.log(`기부자 user id: ${donor.id}`);
console.log(`기부처 user id: ${organizationUser.id}`);

async function ensureDemoUser(email, password) {
  const existing = await findUserByEmail(email);

  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password,
    });
    if (error || !data.user) {
      throw new Error('기존 데모 Auth 계정을 갱신하지 못했습니다.');
    }
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (error || !data.user) {
    throw new Error('데모 Auth 계정을 생성하지 못했습니다.');
  }
  return data.user;
}

async function findUserByEmail(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      throw new Error('Supabase Auth 사용자 목록을 조회하지 못했습니다.');
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    if (user) return user;
    if (data.users.length < 100) return null;
  }
}
