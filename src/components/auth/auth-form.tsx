'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

import {
  getAuthErrorMessage,
  signIn,
  signUp,
} from '@/lib/supabase/auth-client';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';

type Mode = 'login' | 'signup';
type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export function safeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
}

export function validateAuthForm(
  mode: Mode,
  email: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = '이메일을 입력해 주세요.';
  else if (!/^\S+@\S+\.\S+$/.test(email))
    errors.email = '올바른 이메일 주소를 입력해 주세요.';
  if (!password) errors.password = '비밀번호를 입력해 주세요.';
  else if (password.length < 6)
    errors.password = '비밀번호는 6자 이상이어야 합니다.';
  if (mode === 'signup' && password !== confirmPassword) {
    errors.confirmPassword = '비밀번호가 일치하지 않습니다.';
  }
  return errors;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateAuthForm(mode, email, password, confirmPassword);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    let result;
    try {
      result =
        mode === 'login'
          ? await signIn(email, password)
          : await signUp(email, password);
    } catch (error) {
      setMessage(getAuthErrorMessage(error, mode));
      setLoading(false);
      return;
    }
    setPassword('');

    if (result.error) {
      setMessage(getAuthErrorMessage(result.error, mode));
      setLoading(false);
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('가입이 완료되었습니다. 이메일을 확인한 뒤 로그인해 주세요.');
      setLoading(false);
      return;
    }

    router.push(safeNextPath(searchParams.get('next')));
    router.refresh();
  }

  const isLogin = mode === 'login';
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[480px] items-center px-4 py-12 md:px-6">
      <section className="w-full">
        <p className="text-sm font-medium text-accent-strong">모두기브</p>
        <h1 className="mt-2 text-3xl font-bold">
          {isLogin ? '로그인' : '회원가입'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-copy-muted">
          {isLogin
            ? '계정에 로그인해 기부와 기부처 관리 화면을 확인하세요.'
            : '이메일 계정을 만들어 모두기브를 시작하세요.'}
        </p>
        <form className="mt-8 grid gap-5" onSubmit={handleSubmit} noValidate>
          <Input
            error={errors.email}
            label="이메일"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <Input
            error={errors.password}
            label="비밀번호"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          {!isLogin ? (
            <Input
              error={errors.confirmPassword}
              label="비밀번호 확인"
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              value={confirmPassword}
            />
          ) : null}
          {message ? (
            <InlineNotice
              title={isLogin ? '로그인 안내' : '회원가입 안내'}
              tone={message.includes('완료') ? 'info' : 'danger'}
            >
              {message}
            </InlineNotice>
          ) : null}
          <button
            className={buttonClassName({ size: 'large' })}
            disabled={loading}
            type="submit"
          >
            {loading ? '처리 중' : isLogin ? '로그인' : '회원가입'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-copy-muted">
          {isLogin ? '아직 계정이 없나요? ' : '이미 계정이 있나요? '}
          <Link
            className="font-medium text-accent-strong underline-offset-4 hover:underline"
            href={isLogin ? '/signup' : '/login'}
          >
            {isLogin ? '회원가입' : '로그인'}
          </Link>
        </p>
      </section>
    </main>
  );
}
