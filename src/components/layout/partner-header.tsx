'use client';

import Link from 'next/link';
import { MenuIcon, XIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import { getAuthErrorMessage, signOut } from '@/lib/supabase/auth-client';
import { buttonClassName } from '@/components/ui/button';
import {
  isNavigationItemActive,
  partnerNavigation,
  partnerSettingsNavigation,
} from '@/lib/navigation';

import { BrandMark } from './brand-mark';

export function PartnerHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState('');
  const items = [...partnerNavigation, ...partnerSettingsNavigation];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel lg:static">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6 lg:px-9">
        <div className="lg:hidden">
          <BrandMark compact />
        </div>
        <div>
          <p className="text-xs text-copy-muted">기부처 관리</p>
          <p className="text-sm font-bold text-copy">모두기브 파트너</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Link
            aria-label="계정 설정"
            className="grid size-10 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-strong"
            href="/account"
          >
            M
          </Link>
          <button
            className={buttonClassName({ variant: 'tertiary', size: 'small' })}
            onClick={async () => {
              setSignOutMessage('');
              try {
                const { error } = await signOut();
                if (error) {
                  setSignOutMessage(getAuthErrorMessage(error, 'logout'));
                  return;
                }
                window.location.assign('/');
              } catch (error) {
                setSignOutMessage(getAuthErrorMessage(error, 'logout'));
              }
            }}
            type="button"
          >
            로그아웃
          </button>
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? '관리 메뉴 닫기' : '관리 메뉴 열기'}
            className="ml-1 grid size-11 place-items-center rounded-[var(--radius-sm)] hover:bg-panel-muted lg:hidden"
            onClick={() => setMenuOpen((value) => !value)}
            type="button"
          >
            {menuOpen ? (
              <XIcon aria-hidden="true" className="size-5" />
            ) : (
              <MenuIcon aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav
          aria-label="모바일 기부처 관리 메뉴"
          className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-line p-3 lg:hidden"
        >
          {items.map((item) => {
            const active = isNavigationItemActive(pathname, item);
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium',
                  active
                    ? 'bg-accent-soft text-accent-strong'
                    : 'text-copy-secondary',
                )}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            className="mt-2 flex min-h-11 items-center border-t border-line px-3 pt-2 text-sm font-medium"
            href="/"
          >
            기부자 화면으로 전환
          </Link>
        </nav>
      ) : null}
      {signOutMessage ? (
        <p
          className="border-t border-danger bg-danger-soft px-4 py-2 text-center text-xs text-danger"
          role="alert"
        >
          {signOutMessage}
        </p>
      ) : null}
    </header>
  );
}
