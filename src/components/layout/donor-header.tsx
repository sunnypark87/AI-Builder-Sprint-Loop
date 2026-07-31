'use client';

import Link from 'next/link';
import { MenuIcon, XIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { donorNavigation, isNavigationItemActive } from '@/lib/navigation';

import { BrandMark } from './brand-mark';

export function DonorHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const organizationId =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('organizationId');
  const contextHref = (href: string) =>
    organizationId && (href === '/my-donations' || href === '/notifications')
      ? `${href}?organizationId=${encodeURIComponent(organizationId)}`
      : href;

  if (pathname.startsWith('/partner')) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-8 px-4 md:px-6 lg:px-9">
        <BrandMark />
        <nav
          aria-label="주요 메뉴"
          className="hidden h-full items-center gap-1 md:flex"
        >
          {donorNavigation.slice(1).map((item) => {
            const active = isNavigationItemActive(pathname, item);
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex h-full items-center px-3 text-sm font-medium text-copy-muted hover:text-copy',
                  active &&
                    'text-copy after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accent',
                )}
                href={contextHref(item.href)}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link
            className={buttonClassName({ variant: 'tertiary', size: 'small' })}
            href="/account"
          >
            로그인
          </Link>
          <Link
            className={buttonClassName({ variant: 'secondary', size: 'small' })}
            href="/partner"
          >
            기부처 관리
          </Link>
        </div>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          className="ml-auto grid size-11 place-items-center rounded-[var(--radius-sm)] hover:bg-panel-muted md:hidden"
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
      {menuOpen ? (
        <nav
          aria-label="모바일 주요 메뉴"
          className="border-t border-line bg-panel p-3 md:hidden"
        >
          {donorNavigation.slice(1).map((item) => {
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
                href={contextHref(item.href)}
                key={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
            <Link
              className={buttonClassName({ variant: 'tertiary' })}
              href="/account"
              onClick={() => setMenuOpen(false)}
            >
              로그인
            </Link>
            <Link
              className={buttonClassName({ variant: 'secondary' })}
              href="/partner"
              onClick={() => setMenuOpen(false)}
            >
              기부처 관리
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
