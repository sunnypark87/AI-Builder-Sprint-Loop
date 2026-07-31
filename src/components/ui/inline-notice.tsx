import { AlertTriangleIcon, InfoIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function InlineNotice({
  title,
  children,
  tone = 'info',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string;
  children: ReactNode;
  tone?: 'info' | 'warning' | 'danger';
}) {
  const Icon = tone === 'info' ? InfoIcon : AlertTriangleIcon;
  return (
    <div
      {...props}
      className={cn(
        'flex gap-3 rounded-[var(--radius-md)] p-4 text-sm leading-6',
        tone === 'info' && 'bg-info-soft text-info',
        tone === 'warning' && 'bg-warning-soft text-warning',
        tone === 'danger' && 'bg-danger-soft text-danger',
        className,
      )}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-bold">{title}</p>
        <div>{children}</div>
      </div>
    </div>
  );
}
