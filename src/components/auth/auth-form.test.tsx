// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthForm, safeNextPath, validateAuthForm } from './auth-form';

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock('@/lib/supabase/auth-client', () => ({
  getAuthErrorMessage: () => '로그인에 실패했습니다.',
  signIn,
  signUp: vi.fn(),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('next=/my-donations'),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthForm', () => {
  it('validates email and password before calling Supabase', async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByText('이메일을 입력해 주세요.')).toBeTruthy();
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('redirects to the safe internal path after a successful login', async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValue({ data: { session: {} }, error: null });
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('이메일'), 'user@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'secret1');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(signIn).toHaveBeenCalledWith('user@example.com', 'secret1');
    expect(push).toHaveBeenCalledWith('/my-donations');
  });

  it('shows a safe message when the Auth request throws', async () => {
    const user = userEvent.setup();
    signIn.mockRejectedValue(new Error('network unavailable'));
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText('이메일'), 'user@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'secret1');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByText('로그인에 실패했습니다.')).toBeTruthy();
    expect(screen.queryByText('network unavailable')).toBeNull();
  });
});

describe('auth route helpers', () => {
  it('rejects external next paths', () => {
    expect(safeNextPath('https://example.com')).toBe('/');
    expect(safeNextPath('//example.com')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath('/partner')).toBe('/partner');
  });

  it('requires matching signup passwords', () => {
    expect(
      validateAuthForm('signup', 'user@example.com', 'secret1', 'secret2'),
    ).toEqual({ confirmPassword: '비밀번호가 일치하지 않습니다.' });
  });
});
