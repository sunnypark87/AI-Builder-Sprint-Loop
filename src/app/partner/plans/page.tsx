import Link from 'next/link';
import { ManagementList } from '@/components/partner/management-list';
import { PlanRetryButton } from '@/components/partner/plan-retry-button';
import { buttonClassName } from '@/components/ui/button';
import type { StatusTone } from '@/components/ui/status-indicator';
import { createPlanRepository } from '@/lib/plans/plan-repository';
import type { PlanStatus } from '@/lib/plans/types';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const statusLabel: Record<PlanStatus, { label: string; tone: StatusTone }> = {
  analyzing: { label: 'AI 분석 중', tone: 'neutral' },
  review_required: { label: '추출 결과 검토 필요', tone: 'brand' },
  registered: { label: '내부 등록 완료', tone: 'success' },
  analysis_failed: { label: '분석 실패·재시도 필요', tone: 'warning' },
};

async function getPlans() {
  try {
    const supabase = await createClient();
    await requireUserId(supabase);
    return await createPlanRepository(supabase).list();
  } catch {
    return [];
  }
}

function formatMoney(value: number | null) {
  return value === null ? '-' : `${value.toLocaleString('ko-KR')}원`;
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start || !end) {
    return '-';
  }
  return `${start} ~ ${end}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'all' } = await searchParams;
  const plans = await getPlans();
  return (
    <ManagementList
      activeStatus={status}
      basePath="/partner/plans"
      title="집행 계획"
      description="계획서를 등록하고 AI 추출 결과를 검토한 뒤 내부 등록을 완료합니다."
      action={
        <Link className={buttonClassName()} href="/partner/plans/new">
          계획 등록
        </Link>
      }
      columns={[
        { key: 'budget', label: '계획 예산', align: 'right' },
        { key: 'period', label: '집행 기간' },
        { key: 'updatedAt', label: '최근 변경' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'analyzing', label: 'AI 분석 중' },
        { key: 'review_required', label: '추출 결과 검토 필요' },
        { key: 'registered', label: '내부 등록 완료' },
        { key: 'analysis_failed', label: '분석 실패' },
      ]}
      rows={plans.map((plan) => ({
        title: plan.title,
        description: formatMoney(plan.totalAmount),
        status: plan.needsReupload
          ? plan.status === 'analyzing'
            ? '분석 중단·다시 업로드 필요'
            : '원본 업로드 실패·다시 업로드 필요'
          : plan.canRetry && plan.status === 'analyzing'
            ? '분석 중단·재시도 필요'
            : statusLabel[plan.status].label,
        statusKey: plan.status,
        tone: statusLabel[plan.status].tone,
        href:
          plan.status === 'review_required'
            ? `/partner/plans/${plan.id}/review`
            : undefined,
        action:
          plan.canRetry || plan.needsReupload ? (
            <PlanRetryButton canRetry={plan.canRetry} planId={plan.id} />
          ) : undefined,
        cells: {
          budget: formatMoney(plan.totalAmount),
          period: formatPeriod(plan.periodStart, plan.periodEnd),
          updatedAt: new Intl.DateTimeFormat('ko-KR', {
            dateStyle: 'medium',
          }).format(new Date(plan.updatedAt)),
        },
      }))}
    />
  );
}
