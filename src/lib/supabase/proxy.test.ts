import { beforeEach, describe, expect, it, vi } from 'vitest';

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

type ClientOptions = {
  cookies: {
    setAll(cookiesToSet: CookieToSet[]): void;
  };
};

const { createServerClient, getClaims, getCookieAdapter } = vi.hoisted(() => {
  const getClaims = vi.fn();
  let cookieAdapter: ClientOptions['cookies'] | undefined;
  const createServerClient = vi.fn(
    (_url: string, _key: string, options: ClientOptions) => {
      cookieAdapter = options.cookies;
      return { auth: { getClaims } };
    },
  );

  return {
    createServerClient,
    getClaims,
    getCookieAdapter: () => cookieAdapter,
  };
});

vi.mock('@supabase/ssr', () => ({ createServerClient }));

import { NextRequest } from 'next/server';

import { updateSession } from './proxy';

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });
  });

  it('checks the current claims and preserves the request response', async () => {
    const request = new NextRequest('https://example.com/account');

    const response = await updateSession(request);

    expect(createServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      expect.objectContaining({ cookies: expect.any(Object) }),
    );
    expect(getClaims).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it('keeps public requests available when Auth refresh fails', async () => {
    getClaims.mockRejectedValue(new Error('temporary auth failure'));

    const response = await updateSession(
      new NextRequest('https://example.com/organizations'),
    );

    expect(response.status).toBe(200);
  });

  it('copies refreshed cookies to the request and response', async () => {
    const request = new NextRequest('https://example.com/account');
    await updateSession(request);

    getCookieAdapter()?.setAll([
      {
        name: 'sb-session',
        value: 'rotated-token',
        options: { httpOnly: true, path: '/' },
      },
    ]);

    expect(request.cookies.get('sb-session')?.value).toBe('rotated-token');
  });
});
