import Link from 'next/link';

import { ExecutionRetryButton } from '@/components/partner/execution-retry-button';
import { ManagementList } from '@/components/partner/management-list';
import { buttonClassName } from '@/components/ui/button';
import type { StatusTone } from '@/components/ui/status-indicator';
import { createExecutionRepository } from '@/lib/executions/execution-repository';
import type { ExecutionStatus } from '@/lib/executions/types';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const statusLabel: Record<
  ExecutionStatus,
  { label: string; tone: StatusTone }
> = {
  analyzing: { label: '영수증 AI 분석 중', tone: 'neutral' },
  review_required: { label: '추출 결과 검토 필요', tone: 'brand' },
  verification_warning: {
    label: '검증 경고·담당자 확인 필요',
    tone: 'warning',
  },
  registered: { label: '내부 등록 완료', tone: 'success' },
  analysis_failed: { label: '분석 실패·재시도 필요', tone: 'danger' },
};

async function getExecutions() {
  try {
    const supabase = await createClient();
    await requireUserId(supabase);
    return await createExecutionRepository(supabase).list();
  } catch {
    return null;
  }
}

function money(value: number | null) {
  return value === null ? '-' : `${value.toLocaleString('ko-KR')}원`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'all' } = await searchParams;
  const executions = await getExecutions();
  const loadFailed = executions === null;
  return (
    <ManagementList
      activeStatus={status}
      basePath="/partner/executions"
      title="집행 내역"
      description="영수증 원본과 OCR 추출값, 내부 일관성 검증을 확인한 뒤 집행 내역을 등록합니다."
      action={
        <Link className={buttonClassName()} href="/partner/executions/new">
          영수증 등록
        </Link>
      }
      error={
        loadFailed
          ? {
              title: '집행 내역을 불러오지 못했습니다.',
              message:
                '잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.',
            }
          : undefined
      }
      columns={[
        { key: 'amount', label: '집행 금액', align: 'right' },
        { key: 'planItem', label: '계획 예산 항목' },
        { key: 'date', label: '거래일' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'analyzing', label: 'AI 분석 중' },
        { key: 'review_required', label: '추출 결과 검토 필요' },
        { key: 'verification_warning', label: '검증 경고' },
        { key: 'registered', label: '내부 등록 완료' },
        { key: 'analysis_failed', label: '분석 실패' },
      ]}
      rows={(executions ?? []).map((execution) => ({
        id: execution.id,
        title: execution.merchantName,
        description: money(execution.totalAmount),
        status: statusLabel[execution.status].label,
        statusKey: execution.status,
        tone: statusLabel[execution.status].tone,
        href: [
          'review_required',
          'verification_warning',
          'registered',
        ].includes(execution.status)
          ? `/partner/executions/${execution.id}/review`
          : undefined,
        action: execution.retryAvailable ? (
          <ExecutionRetryButton executionId={execution.id} />
        ) : undefined,
        cells: {
          amount: money(execution.totalAmount),
          planItem: execution.planItemName,
          date: execution.transactionAt
            ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(
                new Date(execution.transactionAt),
              )
            : '-',
        },
      }))}
    />
  );
}
