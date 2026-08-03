import Link from 'next/link';

import { ManagementList } from '@/components/partner/management-list';
import { buttonClassName } from '@/components/ui/button';
import type { StatusTone } from '@/components/ui/status-indicator';
import { createReportRepository } from '@/lib/reports/report-repository';
import type { ReportListItem, ReportStatus } from '@/lib/reports/types';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const presentation: Record<ReportStatus, { label: string; tone: StatusTone }> =
  {
    generating: { label: 'AI 초안 생성 중', tone: 'neutral' },
    review_required: { label: '담당자 검토 필요', tone: 'warning' },
    generation_failed: { label: '초안 생성 실패', tone: 'danger' },
    published: { label: '기부자 발행 완료', tone: 'success' },
  };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'all' } = await searchParams;
  let reports: ReportListItem[] = [];
  let loadFailed = false;
  try {
    reports = await createReportRepository(await createClient()).list();
  } catch {
    loadFailed = true;
  }
  if (loadFailed) {
    return (
      <ManagementList
        activeStatus={status}
        basePath="/partner/reports"
        columns={[]}
        description="검증된 계획과 집행 내역으로 AI 초안을 만들고 검토 후 발행합니다."
        error={{
          title: '보고서 목록을 불러오지 못했습니다.',
          message: '잠시 후 다시 시도해 주세요.',
        }}
        rows={[]}
        statusFilters={[{ key: 'all', label: '전체' }]}
        title="완료 보고서"
      />
    );
  }
  return (
    <ManagementList
      action={
        <Link className={buttonClassName()} href="/partner/reports/new">
          보고서 만들기
        </Link>
      }
      activeStatus={status}
      basePath="/partner/reports"
      title="완료 보고서"
      description="검증된 계획과 집행 내역으로 AI 초안을 만들고 검토 후 발행합니다."
      columns={[
        { key: 'period', label: '집행 기간' },
        { key: 'updatedAt', label: '최근 변경' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'generating', label: '초안 생성 중' },
        { key: 'review_required', label: '검토 필요' },
        { key: 'generation_failed', label: '생성 실패' },
        { key: 'published', label: '발행 완료' },
      ]}
      rows={reports.map((report) => ({
        id: report.id,
        title: report.title,
        description: `${report.periodStart} ~ ${report.periodEnd}`,
        status: presentation[report.status].label,
        statusKey: report.status,
        tone: presentation[report.status].tone,
        href: `/partner/reports/${report.id}/review`,
        cells: {
          period: `${report.periodStart} ~ ${report.periodEnd}`,
          updatedAt: new Date(report.updatedAt).toLocaleDateString('ko-KR'),
        },
      }))}
    />
  );
}
