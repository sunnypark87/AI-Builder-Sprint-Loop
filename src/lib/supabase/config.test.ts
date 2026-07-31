import { beforeEach, describe, expect, it } from 'vitest';

import { getSupabasePublishableKey, getSupabaseUrl } from './config';

describe('Supabase configuration', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
  });

  it('returns the public URL and publishable key when configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';

    expect(getSupabaseUrl()).toBe('https://example.supabase.co');
    expect(getSupabasePublishableKey()).toBe('publishable-key');
  });

  it('supports Vercel Integration variable names on the server', () => {
    process.env.SUPABASE_URL = 'https://integration.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'integration-publishable-key';

    expect(getSupabaseUrl()).toBe('https://integration.supabase.co');
    expect(getSupabasePublishableKey()).toBe('integration-publishable-key');
  });

  it('supports the legacy public anon key in browser environments', () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon-key';

    expect(getSupabasePublishableKey()).toBe('legacy-anon-key');
  });

  it('fails without exposing the missing value or a secret', () => {
    process.env.SUPABASE_SECRET_KEY = 'secret-value';

    expect(() => getSupabaseUrl()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL',
    );
    expect(() => getSupabasePublishableKey()).toThrow(
      'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL',
    );
    expect(() => getSupabaseUrl()).not.toThrow('secret-value');
  });
});
