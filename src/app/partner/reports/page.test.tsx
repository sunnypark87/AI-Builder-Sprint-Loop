// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authClient: { kind: 'auth-client' },
  createReportRepository: vi.fn(),
  list: vi.fn(),
  serviceClient: { kind: 'service-client' },
}));

vi.mock('@/lib/supabase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/auth')>()),
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}));
vi.mock('@/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/server')>()),
  createClient: vi.fn().mockResolvedValue(mocks.authClient),
  createServiceClient: vi.fn().mockReturnValue(mocks.serviceClient),
}));
vi.mock('@/lib/reports/report-repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/reports/report-repository')>()),
  createReportRepository: mocks.createReportRepository,
}));

import Page from '@/app/partner/reports/page';

afterEach(() => {
  cleanup();
  mocks.createReportRepository.mockReset();
  mocks.list.mockReset();
});

describe('partner reports page', () => {
  it('keeps report creation available when the list fails', async () => {
    mocks.list.mockRejectedValue(new Error('database unavailable'));
    mocks.createReportRepository.mockReturnValue({ list: mocks.list });

    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('alert').textContent).toContain(
      '보고서 목록을 불러오지 못했습니다.',
    );
    expect(
      screen
        .getByRole('link', { name: '보고서 작성하기' })
        .getAttribute('href'),
    ).toBe('/partner/reports/new');
  });

  it('loads organization-scoped reports through the server client', async () => {
    mocks.list.mockResolvedValue([]);
    mocks.createReportRepository.mockReturnValue({ list: mocks.list });

    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(mocks.createReportRepository).toHaveBeenCalledWith(
      mocks.authClient,
      {
        actorUserId: 'user-1',
        client: mocks.serviceClient,
      },
    );
    expect(
      screen
        .getByRole('link', { name: '보고서 작성하기' })
        .getAttribute('href'),
    ).toBe('/partner/reports/new');
  });
});
