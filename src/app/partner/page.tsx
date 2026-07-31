import { PageHeader } from '@/components/partner/page-header';
import { StatusRow } from '@/components/partner/status-row';
import Link from 'next/link';
export default function PartnerDashboardPage() {
  return (
    <div>
      <PageHeader
        context="오늘의 관리 업무"
        title="기부 계약 관리"
        description="약정부터 집행 보고까지 처리할 업무와 공개 상태를 확인합니다."
      />
      <nav
        aria-label="상태별 관리 업무"
        className="mt-6 grid border-y border-line sm:grid-cols-2 xl:grid-cols-4"
      >
        {[
          [
            '/partner/pledges?status=needs-signature',
            '1건',
            '기부처 서명 필요',
          ],
          ['/partner/plans?status=review', '1건', '계획 추출 결과 검토'],
          ['/partner/executions?status=masking', '1건', '증빙 마스킹 확인'],
          ['/partner/reports?status=review', '1건', '보고서 사실 확인'],
        ].map(([href, count, label]) => (
          <Link
            className="border-b border-line px-4 py-4 hover:bg-panel-muted xl:border-b-0 xl:border-l xl:first:border-l-0"
            href={href}
            key={href}
          >
            <strong className="text-lg">{count}</strong>
            <span className="mt-1 block text-sm text-copy-muted">{label}</span>
          </Link>
        ))}
      </nav>
      <section className="mt-8 border-y border-line">
        <div className="border-b border-line py-4">
          <h2 className="text-lg font-bold">우선 처리할 업무</h2>
        </div>
        <StatusRow
          title="김모아 님 정기 기부 약정"
          description="오늘 17:00까지 · 월 50,000원 · 아동 교육 프로그램"
          status="기부처 서명 필요"
          tone="warning"
          href="/partner/pledges/demo"
        />
        <StatusRow
          title="2026년 8월 교육 프로그램 집행 계획"
          description="오늘까지 · AI가 5개 예산 항목을 추출했습니다."
          status="추출 결과 검토"
          tone="brand"
          href="/partner/plans/demo/review"
        />
        <StatusRow
          title="급식 재료 구매 증빙"
          description="기부자 공개 전 · 영수증 3건 · 총 428,000원"
          status="마스킹 확인 필요"
          tone="danger"
          href="/partner/executions/demo/review"
        />
      </section>
    </div>
  );
}
