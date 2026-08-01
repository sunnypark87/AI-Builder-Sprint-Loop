import { PageHeader } from './page-header';
import Link from 'next/link';

import {
  StatusIndicator,
  type StatusTone,
} from '@/components/ui/status-indicator';
import { cn } from '@/lib/cn';

type Row = {
  title: string;
  description: string;
  status: string;
  statusKey: string;
  tone?: StatusTone;
  href?: string;
  action?: React.ReactNode;
  cells: Record<string, string>;
};

type Column = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  className?: string;
};

type StatusFilter = {
  key: string;
  label: string;
};

export function ManagementList({
  title,
  description,
  rows,
  columns,
  statusFilters,
  activeStatus = 'all',
  basePath,
  action,
}: {
  title: string;
  description: string;
  rows: Row[];
  columns: Column[];
  statusFilters: StatusFilter[];
  activeStatus?: string;
  basePath: string;
  action?: React.ReactNode;
}) {
  const visibleRows =
    activeStatus === 'all'
      ? rows
      : rows.filter((row) => row.statusKey === activeStatus);

  return (
    <div>
      <PageHeader title={title} description={description} action={action} />
      <nav
        aria-label={`${title} 상태`}
        className="mt-6 flex flex-wrap gap-1 border-b border-line"
      >
        {statusFilters.map((filter) => {
          const count =
            filter.key === 'all'
              ? rows.length
              : rows.filter((row) => row.statusKey === filter.key).length;
          const active = activeStatus === filter.key;
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative min-h-11 px-3 py-3 text-sm text-copy-muted hover:text-copy',
                active &&
                  'font-bold text-copy after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accent',
              )}
              href={
                filter.key === 'all'
                  ? basePath
                  : `${basePath}?status=${filter.key}`
              }
              key={filter.key}
            >
              {filter.label} <span className="text-copy-disabled">{count}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 flex items-center justify-between text-sm">
        <p>
          <strong>{visibleRows.length}건</strong>의 업무
        </p>
        {activeStatus !== 'all' ? (
          <Link
            className="text-copy-muted underline underline-offset-4"
            href={basePath}
          >
            필터 초기화
          </Link>
        ) : null}
      </div>
      <section className="mt-3 overflow-hidden border-y border-line">
        <div
          className="hidden min-h-10 grid-cols-[minmax(260px,2fr)_repeat(var(--column-count),minmax(110px,1fr))_120px] items-center gap-4 bg-panel-muted px-4 text-xs font-medium text-copy-muted lg:grid"
          style={{ '--column-count': columns.length } as React.CSSProperties}
        >
          <span>업무</span>
          {columns.map((column) => (
            <span
              className={cn(
                column.align === 'right' && 'text-right',
                column.className,
              )}
              key={column.key}
            >
              {column.label}
            </span>
          ))}
          <span>현재 상태</span>
        </div>
        {visibleRows.length ? (
          visibleRows.map((row) => {
            const content = (
              <>
                <div>
                  <p className="font-bold">{row.title}</p>
                  <p className="mt-1 text-sm text-copy-muted lg:hidden">
                    {row.description}
                  </p>
                </div>
                {columns.map((column) => (
                  <span
                    className={cn(
                      'hidden text-sm lg:block',
                      column.align === 'right' && 'text-right',
                      column.className,
                    )}
                    key={column.key}
                  >
                    {row.cells[column.key]}
                  </span>
                ))}
                <div>
                  <StatusIndicator tone={row.tone}>
                    {row.status}
                  </StatusIndicator>
                  {row.action}
                </div>
              </>
            );
            const className = cn(
              'grid min-h-20 gap-3 border-b border-line px-4 py-4 last:border-0 lg:grid-cols-[minmax(260px,2fr)_repeat(var(--column-count),minmax(110px,1fr))_120px] lg:items-center lg:gap-4',
              row.href && 'hover:bg-panel-muted',
            );
            const style = {
              '--column-count': columns.length,
            } as React.CSSProperties;

            return row.href ? (
              <Link
                className={className}
                href={row.href}
                key={row.title}
                style={style}
              >
                {content}
              </Link>
            ) : (
              <div className={className} key={row.title} style={style}>
                {content}
              </div>
            );
          })
        ) : (
          <div className="px-4 py-12 text-center">
            <p className="font-bold">해당 상태의 업무가 없습니다.</p>
            <p className="mt-2 text-sm text-copy-muted">
              다른 상태를 선택하거나 필터를 초기화해 보세요.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
