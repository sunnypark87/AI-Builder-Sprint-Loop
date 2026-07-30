import { AlertCircleIcon } from 'lucide-react';

import { PageHeader } from '@/components/partner/page-header';
import { PublishConfirmation } from '@/components/partner/publish-confirmation';
import { ReviewWorkspace } from '@/components/partner/review-workspace';
import { buttonClassName } from '@/components/ui/button';

export default function Page() {
  return (
    <div>
      <PageHeader
        context="AI 보고서 초안 · 사실 확인 필요"
        title="7월 급식 지원 완료 보고"
        description="집행 근거와 AI가 작성한 문장을 비교하고 미확인 항목을 검토합니다."
      />
      <ReviewWorkspace
        sourceTitle="7월 급식 지원 집행 근거"
        sourceDescription="공개된 계획 1건 · 집행 증빙 8건"
        source={
          <dl className="grid gap-4">
            <div>
              <dt className="text-copy-muted">계획 예산</dt>
              <dd className="font-bold">3,000,000원</dd>
            </div>
            <div>
              <dt className="text-copy-muted">실제 집행</dt>
              <dd className="font-bold">2,840,000원</dd>
            </div>
            <div>
              <dt className="text-copy-muted">잔액</dt>
              <dd className="font-bold">160,000원</dd>
            </div>
            <div>
              <dt className="text-copy-muted">등록된 증빙</dt>
              <dd className="font-bold">8건</dd>
            </div>
            <div>
              <dt className="text-copy-muted">지원 식사 수</dt>
              <dd className="font-bold">320끼 · 담당자 입력</dd>
            </div>
          </dl>
        }
      >
        <h2 className="text-xl font-bold">
          기부금으로 320끼의 식사를 전했습니다
        </h2>
        <p className="mt-4 text-sm leading-7 text-copy-secondary">
          7월 한 달간 식재료 구매와 배송에 총 2,840,000원을 집행했습니다. 계획
          대비 잔액 160,000원은 다음 달 급식 지원에 이월할 예정입니다.
        </p>
        <div className="mt-6 border-t border-line pt-5 text-sm">
          <strong className="flex items-center gap-2 text-warning">
            <AlertCircleIcon aria-hidden="true" className="size-5" />
            확인되지 않은 항목 2개
          </strong>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-copy-muted">
            <li>지원 식사 수 320끼와 집행 내역 합계 대조</li>
            <li>잔액 이월에 대한 약정 조건 확인</li>
          </ul>
        </div>
      </ReviewWorkspace>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-copy-muted">
          미확인 항목 2개가 남아 있습니다. 발행하면 기부자 1명에게 보고서와
          알림이 전달됩니다.
        </p>
        <div className="flex gap-2">
          <button
            className={buttonClassName({ variant: 'secondary' })}
            type="button"
          >
            초안 수정
          </button>
          <PublishConfirmation
            triggerLabel="검토 완료·발행"
            title="미확인 항목이 있는 보고서를 발행할까요?"
            description="확인되지 않은 항목 2개가 남아 있습니다. 기부자 1명에게 보고서가 발행되고 알림이 전달됩니다."
            confirmLabel="확인하고 발행하기"
            href="/partner/reports"
          />
        </div>
      </div>
    </div>
  );
}
