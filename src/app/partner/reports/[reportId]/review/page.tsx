import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/partner/page-header';
import { ReportRetryButton } from '@/components/partner/report-retry-button';
import { ReportReviewEditor } from '@/components/partner/report-review-editor';
import { DonationReportView } from '@/components/reports/donation-report-view';
import { Card } from '@/components/ui/card';
import { InlineNotice } from '@/components/ui/inline-notice';
import { createReportRepository } from '@/lib/reports/report-repository';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const report = await createReportRepository(supabase, {
    actorUserId: userId,
    client: createServiceClient(),
  }).getReview(reportId);
  if (!report) notFound();

  return (
    <div>
      <PageHeader
        context="AI 보고서 초안 · 사실 확인 필요"
        title={report.title}
        description="서버가 계산한 집행 근거와 AI 문장을 비교하고 기부자 공개 전 직접 확인합니다."
      />
      {report.status === 'generating' ? (
        <InlineNotice className="mt-6" title="AI 초안을 생성하고 있습니다.">
          잠시 후 페이지를 새로고침해 주세요.
        </InlineNotice>
      ) : null}
      {report.status === 'generation_failed' ? (
        <div className="mt-6 grid gap-4">
          <InlineNotice title="AI 초안을 생성하지 못했습니다." tone="danger">
            저장된 근거는 유지됐습니다. 오류 코드:{' '}
            {report.generationErrorCode || 'generation_failed'}
          </InlineNotice>
          {report.retryAvailable ? (
            <ReportRetryButton reportId={report.id} />
          ) : null}
        </div>
      ) : null}
      {report.content ? (
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="h-fit p-5">
            <h2 className="font-bold">검증된 원본 요약</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <dt className="text-copy-muted">약정 목적</dt>
                <dd className="mt-1 font-medium">{report.evidence.purpose}</dd>
              </div>
              <div>
                <dt className="text-copy-muted">계획 예산</dt>
                <dd className="mt-1 font-medium">
                  {report.evidence.plan.totalAmount.toLocaleString('ko-KR')}원
                </dd>
              </div>
              <div>
                <dt className="text-copy-muted">실제 집행</dt>
                <dd className="mt-1 font-medium">
                  {report.evidence.plan.spentAmount.toLocaleString('ko-KR')}원
                </dd>
              </div>
              <div>
                <dt className="text-copy-muted">잔액</dt>
                <dd className="mt-1 font-medium">
                  {report.evidence.plan.remainingAmount.toLocaleString('ko-KR')}
                  원
                </dd>
              </div>
              <div>
                <dt className="text-copy-muted">집행 건수</dt>
                <dd className="mt-1 font-medium">
                  {report.evidence.plan.executionCount}건
                </dd>
              </div>
            </dl>
          </Card>
          {report.status === 'published' ? (
            <div>
              <InlineNotice
                className="mb-6"
                title="기부자에게 발행된 최종본입니다."
              >
                발행된 내용은 읽기 전용이며 원본 데이터가 바뀌어도 발행 당시
                스냅샷을 유지합니다.
              </InlineNotice>
              <DonationReportView
                content={report.content}
                evidence={report.evidence}
              />
            </div>
          ) : (
            <ReportReviewEditor
              evidence={report.evidence}
              initialContent={report.content}
              initialIssues={report.issues}
              reportId={report.id}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
