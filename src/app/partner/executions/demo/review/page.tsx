import { CheckCircle2Icon } from 'lucide-react';

import { PageHeader } from '@/components/partner/page-header';
import { PublishConfirmation } from '@/components/partner/publish-confirmation';
import { ReviewWorkspace } from '@/components/partner/review-workspace';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { StatusIndicator } from '@/components/ui/status-indicator';

export default function Page() {
  return (
    <div>
      <PageHeader
        context="증빙 AI 분석 결과 · 개인정보 확인 필요"
        title="급식 재료 구매 증빙"
        description="원본 영수증과 추출 정보, 기부자에게 공개할 범위를 확인합니다."
      />
      <ReviewWorkspace
        sourceTitle="급식 재료 구매 영수증"
        sourceDescription="업로드된 데모 이미지 · 3건 중 1건"
        source={
          <div className="mx-auto max-w-xs border border-dashed border-line p-5 text-center">
            <strong className="text-lg">해봄마트</strong>
            <p className="mt-4">2026. 08. 12.</p>
            <p className="mt-5 text-left">식재료 외 8개 품목</p>
            <p className="mt-2 border-t border-line pt-2 text-right font-bold">
              합계 428,000원
            </p>
            <p className="mt-5 text-xs text-danger">담당자 010-12**-****</p>
          </div>
        }
      >
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <p className="text-sm text-copy-muted">추출 금액</p>
            <strong className="mt-1 block text-2xl">428,000원</strong>
          </div>
          <StatusIndicator tone="warning">
            확인되지 않은 항목 1개
          </StatusIndicator>
        </div>
        <dl className="divide-y divide-line text-sm">
          <div className="grid grid-cols-[120px_1fr_auto] gap-3 py-4">
            <dt className="text-copy-muted">거래일</dt>
            <dd>2026. 08. 12.</dd>
            <CheckCircle2Icon
              aria-label="원문과 일치"
              className="size-4 text-success"
            />
          </div>
          <div className="grid grid-cols-[120px_1fr_auto] gap-3 py-4">
            <dt className="text-copy-muted">계획 항목</dt>
            <dd>급식 지원</dd>
            <CheckCircle2Icon
              aria-label="원문과 일치"
              className="size-4 text-success"
            />
          </div>
        </dl>
        <InlineNotice
          className="mt-4"
          title="개인정보 확인 필요"
          tone="warning"
        >
          담당자 전화번호가 감지되었습니다. 공개 이미지의 마스킹 상태를
          확인하세요.
        </InlineNotice>
      </ReviewWorkspace>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-copy-muted">
          기부자 1명에게 거래일, 금액, 계획 항목과 마스킹된 증빙 이미지가
          공개됩니다.
        </p>
        <div className="flex gap-2">
          <button
            className={buttonClassName({ variant: 'secondary' })}
            type="button"
          >
            마스킹 수정
          </button>
          <PublishConfirmation
            triggerLabel="검토 완료·공개"
            title="집행 증빙을 공개할까요?"
            description="마스킹된 증빙 이미지와 추출 정보가 기부자 1명에게 공개되고 알림이 발송됩니다."
            confirmLabel="공개하고 알림 보내기"
            href="/partner/executions"
          />
        </div>
      </div>
    </div>
  );
}
