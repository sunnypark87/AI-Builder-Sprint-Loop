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
      basePath="/partner/pledges"
      title="기부 약정 관리"
      description="기부자가 서명한 약정을 검토하고 기부처 서명을 진행합니다."
      columns={[
        { key: 'amount', label: '기부 금액', align: 'right' },
        { key: 'period', label: '약정 기간' },
        { key: 'receivedAt', label: '최근 변경' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'needs-signature', label: '기부처 서명 필요' },
        { key: 'revision', label: '수정 요청' },
        { key: 'completed', label: '완료' },
      ]}
      rows={[
        {
          title: '김모아 님 · 아동 교육 정기 기부',
          description: '월 50,000원 · 12개월',
          status: '기부처 서명 필요',
          statusKey: 'needs-signature',
          tone: 'warning',
          href: '/partner/pledges/demo',
          cells: {
            amount: '월 50,000원',
            period: '12개월',
            receivedAt: '오늘 10:20',
          },
        },
        {
          title: '이푸름 님 · 급식 지원 일시 기부',
          description: '300,000원 · 양측 서명 완료',
          status: '양측 서명 완료',
          statusKey: 'completed',
          tone: 'success',
          href: '/partner/pledges/demo',
          cells: {
            amount: '300,000원',
            period: '일시 기부',
            receivedAt: '7월 28일',
          },
        },
      ]}
    />
  );
}
