import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/partner/page-header';
import { PublishConfirmation } from '@/components/partner/publish-confirmation';
export default function Page() {
  return (
    <div className="max-w-[960px]">
      <PageHeader
        context="약정 검토"
        title="김모아 님 정기 기부 약정"
        description="기부자가 서명한 데모 약정입니다. 조건과 공개 범위를 확인한 뒤 기부처 서명을 진행하세요."
      />
      <Card className="mt-8 divide-y divide-line">
        {[
          ['기부 목적', '아동 교육 프로그램'],
          ['금액', '월 50,000원'],
          ['기간', '12개월'],
          ['집행 공개', '계획·증빙·완료 보고 알림'],
        ].map(([a, b]) => (
          <div className="grid grid-cols-[140px_1fr] p-5 text-sm" key={a}>
            <span className="text-copy-muted">{a}</span>
            <strong>{b}</strong>
          </div>
        ))}
      </Card>
      <div className="mt-6 flex justify-end gap-2">
        <button className={buttonClassName({ variant: 'secondary' })}>
          수정 요청
        </button>
        <PublishConfirmation
          triggerLabel="기부처 서명"
          title="기부 약정에 서명할까요?"
          description="서명하면 기부자에게 완료 알림이 발송되고 결제 단계가 열립니다. 서명 전 금액, 기간과 집행 공개 조건을 확인하세요."
          confirmLabel="서명하고 알림 보내기"
          href="/partner/donations"
        />
      </div>
    </div>
  );
}
