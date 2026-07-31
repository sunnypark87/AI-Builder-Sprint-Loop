'use client';

import { FormEvent, useEffect, useState } from 'react';

import { getCurrentSession } from '@/lib/supabase/auth-client';
import { createClient } from '@/lib/supabase/client';

type HealthState = 'unknown' | 'ok' | 'error';

export function AuthTestPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [healthState, setHealthState] = useState<HealthState>('unknown');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  async function loadState() {
    const [session, healthResponse] = await Promise.all([
      getCurrentSession(),
      fetch('/api/health/supabase', { cache: 'no-store' }),
    ]);

    return {
      userEmail: session?.user.email ?? null,
      healthState: healthResponse.ok ? ('ok' as const) : ('error' as const),
    };
  }

  useEffect(() => {
    let cancelled = false;

    void loadState()
      .then((state) => {
        if (!cancelled) {
          setUserEmail(state.userEmail);
          setHealthState(state.healthState);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealthState('error');
          setMessage('현재 인증 상태를 확인하지 못했습니다.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage('');

    const { error } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    setPassword('');

    if (error) {
      setMessage(
        '로그인에 실패했습니다. 테스트 계정과 환경 설정을 확인하세요.',
      );
      setIsBusy(false);
      return;
    }

    const state = await loadState();
    setUserEmail(state.userEmail);
    setHealthState(state.healthState);
    setMessage(
      '로그인되었습니다. 새로고침 후에도 세션이 유지되는지 확인하세요.',
    );
    setIsBusy(false);
  }

  async function handleSignOut() {
    setIsBusy(true);
    setMessage('');

    const { error } = await createClient().auth.signOut();

    if (error) {
      setMessage('로그아웃에 실패했습니다.');
      setIsBusy(false);
      return;
    }

    const state = await loadState();
    setUserEmail(state.userEmail);
    setHealthState(state.healthState);
    setMessage('로그아웃되었습니다.');
    setIsBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-medium text-slate-500">Development only</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Supabase Auth smoke test
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          테스트 계정으로 로그인, 세션 유지, 로그아웃을 확인하는 임시
          페이지입니다.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">상태</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">현재 사용자</dt>
            <dd className="font-medium text-slate-900">
              {userEmail ?? '비로그인'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Supabase Auth</dt>
            <dd className="font-medium text-slate-900">
              {healthState === 'ok'
                ? '연결됨'
                : healthState === 'error'
                  ? '오류'
                  : '확인 중'}
            </dd>
          </div>
        </dl>
        {userEmail ? (
          <button
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isBusy}
            onClick={handleSignOut}
            type="button"
          >
            로그아웃
          </button>
        ) : null}
      </section>

      {!userEmail ? (
        <form
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={handleSignIn}
        >
          <h2 className="text-lg font-semibold text-slate-950">
            테스트 계정 로그인
          </h2>
          <label
            className="mt-5 block text-sm font-medium text-slate-700"
            htmlFor="email"
          >
            이메일
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label
            className="mt-4 block text-sm font-medium text-slate-700"
            htmlFor="password"
          >
            비밀번호
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            id="password"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <button
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isBusy}
            type="submit"
          >
            로그인
          </button>
        </form>
      ) : null}

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </main>
  );
}
