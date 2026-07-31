// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DonorHeader } from './donor-header';

const { getCurrentSession, signOut, subscribeToAuthState } = vi.hoisted(() => ({
  getCurrentSession: vi.fn(() =>
    Promise.resolve(null as { user: { email: string } } | null),
  ),
  signOut: vi.fn(),
  subscribeToAuthState: vi.fn(() => () => {}),
}));

vi.mock('@/lib/supabase/auth-client', () => ({
  getCurrentSession,
  getAuthErrorMessage: () => '로그아웃에 실패했습니다. 다시 시도해 주세요.',
  signOut,
  subscribeToAuthState,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/organizations',
}));

afterEach(cleanup);

describe('DonorHeader', () => {
  it('opens and closes mobile navigation with an accessible toggle', async () => {
    const user = userEvent.setup();
    render(<DonorHeader />);

    const toggle = screen.getByRole('button', { name: '메뉴 열기' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByRole('navigation', { name: '모바일 주요 메뉴' }),
    ).toBeNull();

    await user.click(toggle);

    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toBeTruthy();
    const mobileNavigation = screen.getByRole('navigation', {
      name: '모바일 주요 메뉴',
    });
    expect(mobileNavigation).toBeTruthy();

    const donationLink = within(mobileNavigation).getByRole('link', {
      name: '내 기부',
    });
    donationLink.addEventListener('click', (event) => event.preventDefault());
    await user.click(donationLink);
    expect(
      screen.queryByRole('navigation', { name: '모바일 주요 메뉴' }),
    ).toBeNull();
  });

  it('closes mobile navigation when a secondary action is selected', async () => {
    const user = userEvent.setup();
    render(<DonorHeader />);

    await user.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const mobileNavigation = screen.getByRole('navigation', {
      name: '모바일 주요 메뉴',
    });
    const accountLink = within(mobileNavigation).getByRole('link', {
      name: '로그인',
    });
    accountLink.addEventListener('click', (event) => event.preventDefault());
    await user.click(accountLink);

    expect(
      screen.queryByRole('navigation', { name: '모바일 주요 메뉴' }),
    ).toBeNull();
  });

  it('shows a recoverable message when donor logout rejects', async () => {
    const user = userEvent.setup();
    signOut.mockRejectedValue(new Error('network unavailable'));
    getCurrentSession.mockResolvedValueOnce({
      user: { email: 'donor@example.com' },
    });
    render(<DonorHeader />);

    await screen.findByRole('button', { name: '로그아웃' });
    await user.click(screen.getAllByRole('button', { name: '로그아웃' })[0]);

    expect(screen.getByRole('alert').textContent).toContain(
      '로그아웃에 실패했습니다. 다시 시도해 주세요.',
    );
  });
});
