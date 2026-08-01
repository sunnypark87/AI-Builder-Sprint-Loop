const missingEnvironmentMessage =
  'Supabase 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL과 공개 키 변수를 확인하세요.';

export class SupabaseConfigurationError extends Error {
  constructor(message = missingEnvironmentMessage) {
    super(message);
    this.name = 'SupabaseConfigurationError';
  }
}

function getRequiredEnvironmentVariable(...values: (string | undefined)[]) {
  const value = values.find(Boolean);

  if (!value) {
    throw new SupabaseConfigurationError();
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

export function getSupabaseSecretKey() {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value) {
    throw new SupabaseConfigurationError(
      'Supabase 서버 비밀 키가 설정되지 않았습니다.',
    );
  }
  return value;
}
