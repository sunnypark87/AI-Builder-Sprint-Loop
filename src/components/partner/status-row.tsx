import Link from 'next/link';
import { ChevronRightIcon } from 'lucide-react';
import {
  StatusIndicator,
  type StatusTone,
} from '@/components/ui/status-indicator';
export function StatusRow({
  title,
  description,
  status,
  tone = 'neutral',
  href,
}: {
  title: string;
  description: string;
  status: string;
  tone?: StatusTone;
  href: string;
}) {
  return (
    <Link
      className="grid min-h-20 grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-4 last:border-0 hover:bg-panel-muted"
      href={href}
    >
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm text-copy-muted">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusIndicator tone={tone}>{status}</StatusIndicator>
        <ChevronRightIcon className="size-4 text-copy-disabled" />
      </div>
    </Link>
  );
}
