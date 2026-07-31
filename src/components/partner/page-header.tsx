import type { ReactNode } from 'react';
export function PageHeader({
  context,
  title,
  description,
  action,
}: {
  context?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {context ? <p className="text-sm text-copy-muted">{context}</p> : null}
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em]">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-copy-muted">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
