// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PartnerHeader } from './partner-header';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock('@/lib/supabase/auth-client', () => ({
  getAuthErrorMessage: () => '로그아웃에 실패했습니다. 다시 시도해 주세요.',
  signOut,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/partner',
}));

afterEach(cleanup);

describe('PartnerHeader', () => {
  it('does not link partner users to donor notifications', () => {
    render(<PartnerHeader />);

    expect(screen.queryByRole('link', { name: '알림' })).toBeNull();
  });

  it('shows a recoverable message when logout fails', async () => {
    const user = userEvent.setup();
    signOut.mockRejectedValue(new Error('network unavailable'));
    render(<PartnerHeader />);

    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(screen.getByRole('alert').textContent).toContain(
      '로그아웃에 실패했습니다. 다시 시도해 주세요.',
    );
  });
});
