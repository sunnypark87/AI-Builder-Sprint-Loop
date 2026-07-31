import Link from 'next/link';
import { ManagementList } from '@/components/partner/management-list';
import { buttonClassName } from '@/components/ui/button';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'all' } = await searchParams;
  return (
    <ManagementList
      activeStatus={status}
      basePath="/partner/plans"
      title="집행 계획"
      description="계획서를 등록하고 AI 추출 결과를 검토한 뒤 기부자에게 공개합니다."
      action={
        <Link className={buttonClassName()} href="/partner/plans/demo/review">
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
        { key: 'review', label: '추출 결과 검토 필요' },
        { key: 'published', label: '공개됨' },
      ]}
      rows={[
        {
          title: '2026년 8월 교육 프로그램 계획',
          description: '5개 예산 항목 · 총 2,400,000원',
          status: 'AI 추출 결과 검토 필요',
          statusKey: 'review',
          tone: 'brand',
          href: '/partner/plans/demo/review',
          cells: {
            budget: '2,400,000원',
            period: '2026. 08.',
            updatedAt: '오늘 09:10',
          },
        },
        {
          title: '2026년 7월 급식 지원 계획',
          description: '2026. 07. 03. 공개',
          status: '기부자 공개 완료',
          statusKey: 'published',
          tone: 'success',
          cells: {
            budget: '3,000,000원',
            period: '2026. 07.',
            updatedAt: '7월 3일',
          },
        },
      ]}
    />
  );
}
