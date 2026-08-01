import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/partner/page-header';
import { PlanReviewForm } from '@/components/partner/plan-review-form';
import { ReviewWorkspace } from '@/components/partner/review-workspace';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { createPlanRepository } from '@/lib/plans/plan-repository';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  let plan;

  try {
    const supabase = await createClient();
    await requireUserId(supabase);
    plan = await createPlanRepository(supabase).getReview(planId);
  } catch {
    return (
      <div>
        <PageHeader
          context="집행 계획 검토"
          description="로그인 상태와 데이터 저장소 구성을 확인해 주세요."
          title="검토 화면을 열 수 없습니다"
        />
        <InlineNotice
          className="mt-6"
          title="집행 계획을 불러오지 못했습니다."
          tone="danger"
        >
          접근 권한이 없거나 Supabase 기반 구성이 아직 완료되지 않았습니다.
        </InlineNotice>
        <Link
          className={`${buttonClassName({ variant: 'secondary' })} mt-6`}
          href="/partner/plans"
        >
          집행 계획 목록
        </Link>
      </div>
    );
  }

  if (!plan) {
    notFound();
  }

  return (
    <div>
      <PageHeader
        context="AI 분석 결과 · 담당자 검토 필요"
        description="원본 계획서와 추출 결과를 비교하고 수정한 뒤 내부 등록을 완료합니다."
        title="집행 계획 항목을 확인하세요"
      />
      <ReviewWorkspace
        source={
          <object
            className="aspect-[3/4] w-full bg-panel"
            data={plan.sourceUrl}
            type={plan.sourceMimeType}
          >
            <p>
              원본을 표시할 수 없습니다.{' '}
              <a className="underline underline-offset-4" href={plan.sourceUrl}>
                원본 문서 열기
              </a>
            </p>
          </object>
        }
        sourceDescription={`${plan.sourceFileName} · 서명 URL은 5분 후 만료`}
        sourceTitle="업로드된 원본 계획서"
      >
        <PlanReviewForm
          initialDraft={plan.draft}
          initialIssues={plan.issues}
          planId={plan.id}
        />
      </ReviewWorkspace>
    </div>
  );
}
