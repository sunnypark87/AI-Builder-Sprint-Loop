'use client';

import { LoaderCircleIcon, SparklesIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import type { EligibleReportDonation } from '@/lib/reports/types';

export function ReportCreateForm({
  donations,
}: {
  donations: EligibleReportDonation[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(donations[0]?.donationId ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const target = donations.find((donation) => donation.donationId === selected);
  const idempotencyKey = useMemo(
    () =>
      target
        ? `report:${target.donationId}:${target.periodStart}:${target.periodEnd}`
        : '',
    [target],
  );

  if (donations.length === 0) {
    return (
      <InlineNotice title="생성할 수 있는 기부가 없습니다." tone="warning">
        서명 완료 약정과 연결된 유료 기부에 등록된 계획과 집행 내역이 있어야
        합니다.
      </InlineNotice>
    );
  }

  return (
    <form
      className="grid max-w-[760px] gap-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!target) return;
        setPending(true);
        setError('');
        try {
          const response = await fetch('/api/partner/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              donationId: target.donationId,
              planId: target.planId,
              idempotencyKey,
            }),
          });
          const result = (await response.json()) as {
            reportId?: string;
            error?: { message?: string };
          };
          if (!response.ok || !result.reportId) {
            setError(
              result.error?.message ?? '보고서 초안을 생성할 수 없습니다.',
            );
            return;
          }
          router.push(`/partner/reports/${result.reportId}/review`);
          router.refresh();
        } catch {
          setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="grid gap-2 text-sm font-bold">
        보고 대상 기부
        <select
          className="min-h-11 rounded-[var(--radius-sm)] border border-line bg-panel px-3 text-sm"
          disabled={pending}
          onChange={(event) => setSelected(event.target.value)}
          value={selected}
        >
          {donations.map((donation) => (
            <option key={donation.donationId} value={donation.donationId}>
              {donation.organizationName} · {donation.planTitle}
            </option>
          ))}
        </select>
      </label>
      {target ? (
        <dl className="grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-copy-muted">기부 목적</dt>
            <dd className="mt-1 font-medium">{target.purpose}</dd>
          </div>
          <div>
            <dt className="text-copy-muted">집행 기간</dt>
            <dd className="mt-1 font-medium">
              {target.periodStart} ~ {target.periodEnd}
            </dd>
          </div>
          <div>
            <dt className="text-copy-muted">등록된 집행</dt>
            <dd className="mt-1 font-medium">{target.executionCount}건</dd>
          </div>
          <div>
            <dt className="text-copy-muted">생성 기준</dt>
            <dd className="mt-1 font-medium">등록 완료 데이터만 사용</dd>
          </div>
        </dl>
      ) : null}
      <InlineNotice title="AI 초안은 자동 발행되지 않습니다.">
        생성 후 근거와 모든 문장을 직접 검토하고 확정해야 기부자에게 공개됩니다.
      </InlineNotice>
      {error ? (
        <InlineNotice title="보고서를 생성하지 못했습니다." tone="danger">
          {error}
        </InlineNotice>
      ) : null}
      <div className="flex justify-end">
        <button
          className={buttonClassName({ size: 'large' })}
          disabled={pending}
          type="submit"
        >
          {pending ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <SparklesIcon aria-hidden="true" className="size-4" />
          )}
          {pending ? '근거 확인·초안 생성 중' : 'AI 보고서 초안 생성'}
        </button>
      </div>
    </form>
  );
}
