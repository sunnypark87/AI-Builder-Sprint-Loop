import { PageHeader } from '@/components/partner/page-header';
import { PlanCreationForm } from '@/components/partner/plan-creation-form';
import { type EligibleDonation } from '@/components/partner/plan-upload-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getEligibleDonations(): Promise<EligibleDonation[]> {
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub) {
      return [];
    }

    const { data, error } = await supabase
      .from('donations')
      .select('id,organization_id')
      .eq('status', 'paid');
    if (error) {
      return [];
    }

    return (data ?? []).map((donation) => ({
      id: donation.id as string,
      organizationId: donation.organization_id as string,
      label: `기부 내역 ${(donation.id as string).slice(0, 8)}`,
    }));
  } catch {
    return [];
  }
}

export default async function Page() {
  const donations = await getEligibleDonations();

  return (
    <div>
      <PageHeader
        context="집행 계획 등록"
        description="계획 내용을 직접 작성하거나, 기존 계획서를 업로드해 자동 입력할 수 있습니다."
        title="집행 계획을 등록하세요"
      />
      <PlanCreationForm donations={donations} />
    </div>
  );
}
