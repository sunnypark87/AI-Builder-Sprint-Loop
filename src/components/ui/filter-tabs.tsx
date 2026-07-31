import Link from 'next/link';

import { cn } from '@/lib/cn';

export function FilterTabs({
  label,
  items,
}: {
  label: string;
  items: Array<{
    label: string;
    href: string;
    active?: boolean;
    count?: number;
  }>;
}) {
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap gap-1 border-b border-line"
    >
      {items.map((item) => (
        <Link
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'relative min-h-11 px-3 py-3 text-sm text-copy-muted hover:text-copy',
            item.active &&
              'font-bold text-copy after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accent',
          )}
          href={item.href}
          key={item.href}
        >
          {item.label}
          {item.count != null ? (
            <span className="ml-1 text-copy-disabled">{item.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
