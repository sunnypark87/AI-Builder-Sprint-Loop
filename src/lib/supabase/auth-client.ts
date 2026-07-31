'use client';

import type {
  AuthChangeEvent,
  AuthResponse,
  Session,
  User,
} from '@supabase/supabase-js';

import { createClient } from './client';

/** Returns the browser session for displaying client-side auth state. */
export async function getCurrentSession(): Promise<Session | null> {
  const {
    data: { session },
    error,
  } = await createClient().auth.getSession();

  return error ? null : session;
}

/**
 * Subscribes to browser auth changes and returns a safe unsubscribe function.
 * The callback is intended for UI state only, not authorization decisions.
 */
export function subscribeToAuthState(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const {
    data: { subscription },
  } = createClient().auth.onAuthStateChange(callback);

  return () => subscription.unsubscribe();
}

export function getAuthErrorMessage(
  error: unknown,
  mode: 'login' | 'signup' | 'logout',
) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (mode === 'logout')
    return '로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.';
  if (message.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호를 확인해 주세요.';
  }
  if (message.includes('user already registered')) {
    return '이미 가입된 이메일입니다. 로그인해 주세요.';
  }
  if (message.includes('rate limit')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  return mode === 'login'
    ? '로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    : '회원가입 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return createClient().auth.signInWithPassword({ email, password });
}

export async function signUp(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return createClient().auth.signUp({ email, password });
}

export async function signOut() {
  return createClient().auth.signOut();
}

export type AuthUser = User;
