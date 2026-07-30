import { ManagementList } from '@/components/partner/management-list';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'all' } = await searchParams;
  return (
    <ManagementList
      activeStatus={status}
      basePath="/partner/reports"
      title="완료 보고서"
      description="AI가 작성한 보고서 초안을 검토하고 기부자에게 발행합니다."
      columns={[
        { key: 'donors', label: '공개 대상', align: 'right' },
        { key: 'period', label: '집행 기간' },
        { key: 'updatedAt', label: '최근 변경' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'generating', label: '초안 생성 중' },
        { key: 'review', label: '담당자 검토 필요' },
        { key: 'published', label: '발행 완료' },
      ]}
      rows={[
        {
          title: '7월 급식 지원 완료 보고',
          description: '집행 내역 8건을 바탕으로 초안 생성',
          status: '담당자 사실 확인 필요',
          statusKey: 'review',
          tone: 'warning',
          href: '/partner/reports/demo/review',
          cells: {
            donors: '기부자 1명',
            period: '2026. 07.',
            updatedAt: '오늘 08:30',
          },
        },
        {
          title: '2026년 6월 교육 프로그램 보고',
          description: '기부자 12명에게 발행됨',
          status: '기부자 발행 완료',
          statusKey: 'published',
          tone: 'success',
          href: '/partner/reports/demo/review',
          cells: {
            donors: '기부자 12명',
            period: '2026. 06.',
            updatedAt: '7월 2일',
          },
        },
      ]}
    />
  );
}
