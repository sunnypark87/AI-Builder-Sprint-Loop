import { PageHeader } from '@/components/partner/page-header';
import { ReportCreateForm } from '@/components/partner/report-create-form';
import { createReportRepository } from '@/lib/reports/report-repository';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const donations = await createReportRepository(supabase, {
    actorUserId: userId,
    client: createServiceClient(),
  }).listEligible();
  return (
    <div>
      <PageHeader
        context="완료 보고서"
        title="AI 보고서 초안 만들기"
        description="서명 완료 약정과 등록된 계획·집행 내역만 보고 근거로 사용합니다."
      />
      <div className="mt-8">
        <ReportCreateForm donations={donations} />
      </div>
    </div>
  );
}
