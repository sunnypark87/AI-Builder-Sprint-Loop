import Link from 'next/link';

import { cn } from '@/lib/cn';

const steps = [
  { label: '기부처 정보', href: '/partner/register' },
  { label: '약정서 템플릿', href: '/partner/register/pledge-template' },
];

export function RegistrationProgress({ current }: { current: 1 | 2 }) {
  return (
    <nav aria-label="기부처 등록 단계" className="max-w-xl">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">기부처 등록</span>
        <span className="text-copy-muted">{current}/2 단계</span>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-2">
        {steps.map((step, index) => {
          const number = index + 1;
          const active = number === current;
          const complete = number < current;
          return (
            <li aria-current={active ? 'step' : undefined} key={step.href}>
              <span
                className={cn(
                  'block h-1 bg-line',
                  (active || complete) && 'bg-accent',
                )}
              />
              {complete ? (
                <Link
                  className="mt-2 inline-block text-xs text-copy-muted"
                  href={step.href}
                >
                  {number}. {step.label}
                </Link>
              ) : (
                <span
                  aria-disabled={!active || undefined}
                  className={cn(
                    'mt-2 inline-block text-xs text-copy-disabled',
                    active && 'font-bold text-copy',
                  )}
                >
                  {number}. {step.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
