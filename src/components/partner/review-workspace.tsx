import type { ReactNode } from 'react';

export function ReviewWorkspace({
  sourceTitle,
  sourceDescription,
  source,
  children,
}: {
  sourceTitle: string;
  sourceDescription: string;
  source: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-6 grid overflow-hidden border-y border-line lg:grid-cols-2 lg:border-x">
      <section className="bg-panel-muted p-5 lg:min-h-[520px] lg:border-r lg:border-line">
        <p className="text-xs font-medium text-copy-muted">원본 자료</p>
        <h2 className="mt-1 text-lg font-bold">{sourceTitle}</h2>
        <p className="mt-1 text-sm text-copy-muted">{sourceDescription}</p>
        <div className="mt-5 bg-panel p-5 text-sm leading-7 shadow-[var(--shadow-overlay)]">
          {source}
        </div>
      </section>
      <section className="p-5">
        <p className="text-xs font-medium text-accent-strong">
          AI 추출 결과 · 담당자 검토 필요
        </p>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}
