import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/partner/page-header';
import { Card } from '@/components/ui/card';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { getOrganizationIds } from '@/lib/organizations/membership';
import { getPartnerDonationDetail } from '@/lib/partner/donation-detail-repository';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

function money(value: number) {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function actionHref(
  donationId: string,
  pledgeId: string | null,
  action: 'signature' | 'payment' | 'plan' | 'execution' | 'report' | null,
) {
  if (action === 'signature' || action === 'payment') {
    return pledgeId ? `/partner/pledges/${pledgeId}` : null;
  }
  if (action === 'plan') {
    return `/partner/plans/new?donationId=${encodeURIComponent(donationId)}`;
  }
  if (action === 'execution') return '/partner/executions/new';
  if (action === 'report') return '/partner/reports/new';
  return null;
}

export default async function PartnerDonationDetailPage({
  params,
}: {
  params: Promise<{ donationId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { donationId } = await params;
  const supabase = await createClient();
  const memberships = await getOrganizationIds(supabase, user.id);
  if (memberships.error)
    throw new Error('organization_membership_lookup_failed');
  if (!memberships.data.length) notFound();

  const detail = await getPartnerDonationDetail(
    supabase,
    donationId,
    memberships.data,
  );
  if (!detail) notFound();

  const { donation, pledge, progress } = detail;
  const nextHref = actionHref(
    donation.id,
    pledge?.id ?? null,
    progress.nextActionKind,
  );

  return (
    <div className="max-w-[960px]">
      <PageHeader
        context="기부 상세"
        title={
          pledge
            ? `${detail.organizationName} · ${pledge.donor_name} 님 기부 이행`
            : `${detail.organizationName} · 기부 상세`
        }
        description="약정, 결제, 계획, 집행과 보고 진행 상태를 실제 저장 데이터로 확인합니다."
      />

      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="text-sm text-copy-muted">현재 단계</p>
            <StatusIndicator className="mt-2" tone={progress.tone}>
              {progress.label}
            </StatusIndicator>
          </div>
          {nextHref ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-accent px-4 text-sm font-bold text-white"
              href={nextHref}
            >
              {progress.nextAction}
            </Link>
          ) : null}
        </div>

        <dl className="grid gap-4 py-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-copy-muted">기부 금액</dt>
            <dd className="mt-1 font-bold">{money(donation.amount)}</dd>
          </div>
          <div>
            <dt className="text-copy-muted">기부 유형</dt>
            <dd className="mt-1 font-bold">
              {pledge?.donation_type ?? '기부'}
            </dd>
          </div>
          <div>
            <dt className="text-copy-muted">약정일</dt>
            <dd className="mt-1 font-bold">{pledge?.pledge_date ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-copy-muted">기부 상태</dt>
            <dd className="mt-1 font-bold">{donation.status}</dd>
          </div>
          {pledge ? (
            <>
              <div className="sm:col-span-2">
                <dt className="text-copy-muted">기부 목적</dt>
                <dd className="mt-1 leading-6">{pledge.purpose}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-copy-muted">집행·공개 조건</dt>
                <dd className="mt-1 leading-6">
                  {pledge.donation_condition || '별도 조건 없음'}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
      </Card>

      <Card className="mt-6 divide-y divide-line">
        {detail.milestones.map((milestone) => (
          <div
            className="grid grid-cols-[1fr_auto] gap-4 p-5"
            key={milestone.key}
          >
            <div>
              <strong>{milestone.label}</strong>
              <p className="mt-1 text-sm text-copy-muted">{milestone.detail}</p>
            </div>
            <StatusIndicator
              tone={
                milestone.state === 'complete'
                  ? 'success'
                  : milestone.state === 'current'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {milestone.state === 'complete'
                ? '완료'
                : milestone.state === 'current'
                  ? '다음 단계'
                  : '대기'}
            </StatusIndicator>
          </div>
        ))}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-bold">지출 계획</h2>
          <ul className="mt-3 grid gap-2 text-sm text-copy-muted">
            {detail.plans.length ? (
              detail.plans.map((plan) => (
                <li key={plan.id}>
                  {plan.title || '이름 없는 계획'} · {plan.status}
                </li>
              ))
            ) : (
              <li>등록된 계획이 없습니다.</li>
            )}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold">집행·보고</h2>
          <p className="mt-3 text-sm text-copy-muted">
            집행 {detail.executions.length}건 · 보고서 {detail.reports.length}건
          </p>
        </Card>
      </div>
    </div>
  );
}
