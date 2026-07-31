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
      basePath="/partner/donations"
      title="기부 관리"
      description="기부 건별 현재 단계와 다음 처리 업무를 확인합니다."
      columns={[
        { key: 'amount', label: '기부 금액', align: 'right' },
        { key: 'nextAction', label: '다음 업무' },
        { key: 'updatedAt', label: '최근 변경' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'payment', label: '결제 대기' },
        { key: 'executing', label: '집행 중' },
        { key: 'report', label: '보고 필요' },
        { key: 'completed', label: '완료' },
      ]}
      rows={[
        {
          title: '김모아 님 · 아동 교육 프로그램',
          description: '2026. 08. ~ 2027. 07.',
          status: '집행 증빙 등록 필요',
          statusKey: 'executing',
          tone: 'warning',
          href: '/partner/donations/demo',
          cells: {
            amount: '월 50,000원',
            nextAction: '8월 증빙 등록',
            updatedAt: '오늘 09:40',
          },
        },
        {
          title: '이푸름 님 · 급식 지원',
          description: '2026. 07. 일시 기부',
          status: '담당자 보고서 발행 필요',
          statusKey: 'report',
          tone: 'warning',
          href: '/partner/reports',
          cells: {
            amount: '300,000원',
            nextAction: '완료 보고 발행',
            updatedAt: '7월 29일',
          },
        },
      ]}
    />
  );
}
