import {
  ExecutionUploadForm,
  type ExecutionUploadOption,
} from '@/components/partner/execution-upload-form';
import { PageHeader } from '@/components/partner/page-header';
import { InlineNotice } from '@/components/ui/inline-notice';
import { createExecutionRepository } from '@/lib/executions/execution-repository';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getOptions(): Promise<ExecutionUploadOption[] | null> {
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
    return null;
  }
}

export default async function Page() {
  const options = await getOptions();
  return (
    <div>
      <PageHeader
        context="기부 집행 내역 등록"
        description="등록 완료된 집행 계획의 예산 항목을 선택하고 영수증 원본을 업로드합니다."
        title="영수증을 분석하세요"
      />
      {options === null ? (
        <InlineNotice
          className="mt-8"
          title="등록 가능한 계획 항목을 불러오지 못했습니다."
          tone="danger"
        >
          잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
        </InlineNotice>
      ) : (
        <ExecutionUploadForm options={options} />
      )}
    </div>
  );
}
