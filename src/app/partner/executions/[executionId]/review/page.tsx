import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ExecutionReviewForm } from '@/components/partner/execution-review-form';
import { PageHeader } from '@/components/partner/page-header';
import { ReviewWorkspace } from '@/components/partner/review-workspace';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { createExecutionRepository } from '@/lib/executions/execution-repository';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ executionId: string }>;
}) {
  const { executionId } = await params;
  let execution;
  try {
    const supabase = await createClient();
    await requireUserId(supabase);
    execution =
      await createExecutionRepository(supabase).getReview(executionId);
  } catch {
    return (
      <div>
        <PageHeader
          context="영수증 검토"
          description="로그인 상태와 데이터 저장소 구성을 확인해 주세요."
          title="검토 화면을 열 수 없습니다"
        />
        <InlineNotice
          className="mt-6"
          title="집행 내역을 불러오지 못했습니다."
          tone="danger"
        >
          접근 권한이 없거나 Supabase 기반 구성이 완료되지 않았습니다.
        </InlineNotice>
        <Link
          className={`${buttonClassName({ variant: 'secondary' })} mt-6`}
          href="/partner/executions"
        >
          집행 내역 목록
        </Link>
      </div>
    );
  }
  if (!execution) notFound();

  return (
    <div>
      <PageHeader
        context="영수증 AI 분석 결과 · 담당자 검토 필요"
        description="원본, 추출값과 내부 일관성 검증 근거를 확인한 뒤 집행 내역을 내부 등록합니다."
        title="영수증 정보를 확인하세요"
      />
      <ReviewWorkspace
        source={
          <object
            className="aspect-[3/4] w-full bg-panel"
            data={execution.sourceUrl}
            type={execution.sourceMimeType}
          >
            <p>
              원본을 표시할 수 없습니다.{' '}
              <a
                className="underline underline-offset-4"
                href={execution.sourceUrl}
              >
                원본 영수증 열기
              </a>
            </p>
          </object>
        }
        sourceDescription={`${execution.sourceFileName} · 서명 URL은 5분 후 만료`}
        sourceTitle="업로드된 원본 영수증"
      >
        <ExecutionReviewForm
          executionId={execution.id}
          initialDraft={execution.draft}
          initialIssues={execution.issues}
          initialVerificationResults={execution.verificationResults}
          initialWarningReason={execution.warningReason}
          planItemName={execution.planItemName}
          readOnly={execution.status === 'registered'}
          remainingBudget={execution.remainingBudget}
        />
      </ReviewWorkspace>
    </div>
  );
}
