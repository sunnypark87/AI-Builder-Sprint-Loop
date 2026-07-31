const missingEnvironmentMessage =
  'Supabase 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL과 공개 키 변수를 확인하세요.';

function getRequiredEnvironmentVariable(...values: (string | undefined)[]) {
  const value = values.find(Boolean);

  if (!value) {
    throw new Error(missingEnvironmentMessage);
  }

  return value;
}

export function getSupabaseUrl() {
  return getRequiredEnvironmentVariable(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  );
}

export function getSupabasePublishableKey() {
  return getRequiredEnvironmentVariable(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  );
}
