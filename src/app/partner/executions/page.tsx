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
      basePath="/partner/executions"
      title="집행 내역"
      description="증빙의 AI 추출 결과와 개인정보 공개 범위를 확인합니다."
      action={
        <Link
          className={buttonClassName()}
          href="/partner/executions/demo/review"
        >
          증빙 등록
        </Link>
      }
      columns={[
        { key: 'amount', label: '집행 금액', align: 'right' },
        { key: 'plan', label: '연결된 계획' },
        { key: 'date', label: '거래일' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'masking', label: '마스킹 확인 필요' },
        { key: 'review', label: '추출 결과 검토 필요' },
        { key: 'published', label: '공개됨' },
      ]}
      rows={[
        {
          title: '급식 재료 구매 · 영수증 3건',
          description: '총 428,000원 · 상호명과 금액 추출 완료',
          status: '개인정보 마스킹 확인 필요',
          statusKey: 'masking',
          tone: 'danger',
          href: '/partner/executions/demo/review',
          cells: {
            amount: '428,000원',
            plan: '8월 급식 지원',
            date: '2026. 08. 12.',
          },
        },
        {
          title: '교육 교재 구매 · 거래명세서',
          description: '총 610,000원',
          status: '기부자 공개 완료',
          statusKey: 'published',
          tone: 'success',
          cells: {
            amount: '610,000원',
            plan: '8월 교육 프로그램',
            date: '2026. 08. 08.',
          },
        },
      ]}
    />
  );
}
