import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleIcon,
  Clock3Icon,
  InfoIcon,
} from 'lucide-react';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type StatusTone =
  'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';

const styles: Record<StatusTone, string> = {
  neutral: 'text-copy-muted',
  brand: 'text-accent-strong',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const icons = {
  neutral: CircleIcon,
  brand: Clock3Icon,
  info: InfoIcon,
  success: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  danger: AlertTriangleIcon,
} satisfies Record<StatusTone, typeof CircleIcon>;

export function StatusIndicator({
  tone = 'neutral',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  const Icon = icons[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        styles[tone],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}
