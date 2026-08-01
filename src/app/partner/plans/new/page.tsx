import { PageHeader } from '@/components/partner/page-header';
import {
  PlanUploadForm,
  type EligibleDonation,
} from '@/components/partner/plan-upload-form';
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
        description="기부 내역을 선택하고 기부처에서 작성한 집행 계획서를 등록합니다."
        title="계획서를 업로드하세요"
      />
      <PlanUploadForm donations={donations} />
    </div>
  );
}
