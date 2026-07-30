import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/cn';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      aria-label="MODUGIVE 홈"
      className="inline-flex shrink-0 items-center gap-2.5 text-copy"
      href="/"
    >
      <Image alt="" height={32} priority src="/modugive_logo.svg" width={32} />
      <span
        className={cn(
          'text-lg font-bold tracking-[-0.02em]',
          compact && 'sr-only',
        )}
      >
        MODUGIVE
      </span>
    </Link>
  );
}
