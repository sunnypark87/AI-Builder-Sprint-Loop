'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ImpactSummaryResponse } from '@/lib/organizations/impact-summary';

export function ImpactSummaryPanel({
  organizationId,
  onSelectActivity,
}: {
  organizationId: string;
  onSelectActivity?: (condition: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ImpactSummaryResponse | null>(null);

  async function load() {
    if (data || loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/impact-summary`,
      );
      if (!response.ok) throw new Error('impact_summary_failed');
      setData((await response.json()) as ImpactSummaryResponse);
    } catch {
      setError('등록된 성과 자료를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const summary = data?.summary;
  const programs = data?.programs ?? [];

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) void load();
  }

  function selectActivity(condition: string) {
    onSelectActivity?.(condition);
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <section className="border-y border-line py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">재단 활동과 성과</p>
            <p className="mt-1 text-xs leading-5 text-copy-muted">
              등록된 보고서에 근거한 AI 성과 요약을 확인할 수 있습니다.
            </p>
          </div>
          <DialogTrigger asChild>
            <Button className="shrink-0" size="small" variant="secondary">
              재단 활동과 성과 보기
            </Button>
          </DialogTrigger>
        </div>
      </section>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-line px-5 py-5 sm:px-6">
          <DialogTitle>재단 활동과 성과</DialogTitle>
          <DialogDescription>
            등록된 보고서를 바탕으로 정리한 AI 성과 요약입니다. 원하는 활동을
            선택하면 채팅 입력창에 기부 조건이 채워집니다.
          </DialogDescription>
        </DialogHeader>
        <div
          aria-live="polite"
          className="max-h-[calc(100vh-11rem)] overflow-y-auto px-5 py-5 sm:px-6"
        >
          {loading ? (
            <p className="text-sm text-copy-muted" role="status">
              성과 자료를 불러오는 중입니다.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {data && !data.summary ? (
            <p className="text-sm text-copy-muted">
              등록된 성과 요약 자료가 아직 없습니다.
            </p>
          ) : null}
          {summary ? (
            <section className="border-b border-line pb-5">
              <p className="text-sm leading-6">{summary.overview}</p>
              <p className="mt-2 text-xs text-copy-muted">
                {summary.reportingPeriod ?? '등록'}년 재단 자료 기준 · AI 요약
                예시
              </p>
              {summary.limitations.map((limitation) => (
                <p className="mt-2 text-xs text-copy-muted" key={limitation}>
                  안내: {limitation}
                </p>
              ))}
            </section>
          ) : null}
          {programs.length ? (
            <div className="divide-y divide-line">
              {programs.map((program) => (
                <section className="py-5 first:pt-0" key={program.id}>
                  <p className="font-bold">{program.name}</p>
                  <p className="mt-1 text-sm leading-6">
                    {program.description}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-copy-muted sm:grid-cols-2">
                    {program.facts.slice(0, 4).map((fact) => (
                      <p key={fact.id}>
                        {fact.label}:{' '}
                        <strong>
                          {formatMetric(fact.value)}
                          {fact.unit ? ` ${fact.unit}` : ''}
                        </strong>
                      </p>
                    ))}
                  </div>
                  {onSelectActivity ? (
                    <Button
                      className="mt-3 w-full sm:w-auto"
                      onClick={() =>
                        selectActivity(
                          `${program.name}에 지정 기부하고 싶어요. ${program.suggestedConditions[0] ?? `${program.name} 지원에 사용해 주세요`}`,
                        )
                      }
                      size="small"
                      variant="secondary"
                    >
                      이 활동으로 기부 조건 작성
                    </Button>
                  ) : null}
                </section>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatMetric(value: number | string) {
  return typeof value === 'number' ? value.toLocaleString('ko-KR') : value;
}
