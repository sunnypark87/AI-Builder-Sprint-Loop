import { CheckCircle2Icon, SparklesIcon } from 'lucide-react';

import { PageHeader } from '@/components/partner/page-header';
import { PublishConfirmation } from '@/components/partner/publish-confirmation';
import { ReviewWorkspace } from '@/components/partner/review-workspace';
import { buttonClassName } from '@/components/ui/button';

const rows = [
  ['교육 강사비', '1,200,000원'],
  ['교재 및 준비물', '600,000원'],
  ['급식 지원', '420,000원'],
  ['교통비', '120,000원'],
  ['운영비', '60,000원'],
];

export default function Page() {
  return (
    <div>
      <PageHeader
        context="AI 분석 결과 · 담당자 검토 필요"
        title="집행 계획 항목을 확인하세요"
        description="원본 계획서와 추출된 금액을 비교한 뒤 기부자 공개 범위를 확정합니다."
      />
      <ReviewWorkspace
        sourceTitle="2026년 8월 교육 프로그램 계획서"
        sourceDescription="업로드된 데모 PDF · 2페이지"
        source={
          <>
            <strong>2. 세부 예산</strong>
            <p className="mt-3">
              교육 강사비 1,200,000원
              <br />
              교재 및 준비물 600,000원
              <br />
              급식 지원 420,000원
              <br />
              교통비 120,000원
              <br />
              운영비 60,000원
            </p>
            <p className="mt-5 text-copy-muted">총 계획 예산 2,400,000원</p>
          </>
        }
      >
        <div className="flex gap-3 border-b border-line pb-4">
          <SparklesIcon
            aria-hidden="true"
            className="size-5 text-accent-strong"
          />
          <div>
            <strong>5개 항목 추출 완료</strong>
            <p className="mt-1 text-sm text-copy-muted">
              모든 항목은 공개 전 담당자가 확인해야 합니다.
            </p>
          </div>
        </div>
        <dl className="divide-y divide-line">
          {rows.map(([label, value]) => (
            <div
              className="grid grid-cols-[1fr_auto] gap-4 py-4 text-sm"
              key={label}
            >
              <dt>{label}</dt>
              <dd className="flex items-center gap-2 font-bold">
                <CheckCircle2Icon
                  aria-label="원문과 일치"
                  className="size-4 text-success"
                />
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </ReviewWorkspace>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-copy-muted">
          기부자 1명에게 계획명, 집행 기간, 예산 5개 항목이 공개되고 알림이
          발송됩니다.
        </p>
        <div className="flex gap-2">
          <button
            className={buttonClassName({ variant: 'secondary' })}
            type="button"
          >
            항목 수정
          </button>
          <PublishConfirmation
            triggerLabel="검토 완료·공개"
            title="집행 계획을 공개할까요?"
            description="기부자 1명에게 예산 5개 항목이 공개되고 알림이 발송됩니다. 공개 후에도 정정 이력이 함께 기록됩니다."
            confirmLabel="공개하고 알림 보내기"
            href="/partner/plans"
          />
        </div>
      </div>
    </div>
  );
}
