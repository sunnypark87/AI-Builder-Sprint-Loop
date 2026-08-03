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
      <Image
        alt="MODUGIVE"
        className="shrink-0"
        height={32}
        priority
        src="/modugive_logo.svg"
        width={32}
      />
      <Image
        alt=""
        className={cn('h-auto w-[148px] object-contain', compact && 'sr-only')}
        height={26}
        priority
        src="/modugive.png"
        width={148}
      />
    </Link>
  );
}
