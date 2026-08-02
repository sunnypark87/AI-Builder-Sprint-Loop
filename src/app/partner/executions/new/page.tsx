import {
  ExecutionUploadForm,
  type ExecutionUploadOption,
} from '@/components/partner/execution-upload-form';
import { PageHeader } from '@/components/partner/page-header';
import { createExecutionRepository } from '@/lib/executions/execution-repository';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getOptions(): Promise<ExecutionUploadOption[]> {
  try {
    const supabase = await createClient();
    await requireUserId(supabase);
    return (await createExecutionRepository(supabase).listEligible()).map(
      (option) => ({
        organizationId: option.organizationId,
        donationId: option.donationId,
        planId: option.planId,
        planTitle: option.planTitle,
        planItemId: option.planItemId,
        planItemName: option.planItemName,
        remainingBudget: option.remainingBudget,
      }),
    );
  } catch {
    return [];
  }
}

export default async function Page() {
  return (
    <div>
      <PageHeader
        context="기부 집행 내역 등록"
        description="등록 완료된 집행 계획의 예산 항목을 선택하고 영수증 원본을 업로드합니다."
        title="영수증을 분석하세요"
      />
      <ExecutionUploadForm options={await getOptions()} />
    </div>
  );
}
