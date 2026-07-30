'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import {
  isNavigationItemActive,
  partnerNavigation,
  partnerSettingsNavigation,
  type NavigationItem,
} from '@/lib/navigation';

import { BrandMark } from './brand-mark';

function NavigationGroup({
  label,
  items,
}: {
  label: string;
  items: NavigationItem[];
}) {
  const pathname = usePathname();
  return (
    <div>
      <p className="mb-2 px-3 text-xs font-medium text-copy-disabled">
        {label}
      </p>
      <nav aria-label={label} className="grid gap-1">
        {items.map((item) => {
          const active = isNavigationItemActive(pathname, item);
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-10 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent-soft text-accent-strong'
                  : 'text-copy-secondary hover:bg-panel-muted hover:text-copy',
              )}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PartnerSidebar() {
  return (
    <aside className="hidden min-h-screen w-66 shrink-0 border-r border-line bg-panel lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-line px-5">
        <BrandMark />
      </div>
      <div className="border-b border-line p-4">
        <p className="text-xs text-copy-muted">기부처 워크스페이스</p>
        <p className="mt-1 truncate text-sm font-bold text-copy">
          모두기브 파트너
        </p>
      </div>
      <div className="grid gap-8 overflow-y-auto px-3 py-5">
        <NavigationGroup items={partnerNavigation} label="기부 운영" />
        <NavigationGroup items={partnerSettingsNavigation} label="설정" />
      </div>
      <Link
        className="mx-3 mb-4 mt-auto flex min-h-10 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium text-copy-secondary hover:bg-panel-muted"
        href="/"
      >
        기부자 화면으로 전환
      </Link>
    </aside>
  );
}
