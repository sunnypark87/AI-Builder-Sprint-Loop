import { ManagementList } from '@/components/partner/management-list';
import { getActiveOrganizationMembership } from '@/lib/organizations/membership';
import { getPaymentStatusPresentation } from '@/lib/payments/presentation';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'all' } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: membership, error: membershipError } =
    await getActiveOrganizationMembership(supabase, user.id);
  if (membershipError) throw new Error('organization_membership_lookup_failed');
  const { data: pledges } = membership
    ? await supabase
        .from('pledges')
        .select(
          'id, amount, donation_type, purpose, status, updated_at, donor_name',
        )
        .eq('organization_id', membership.organization_id)
        .order('updated_at', { ascending: false })
    : { data: [] };
  const pledgeIds = (pledges ?? []).map((pledge) => pledge.id);
  const { data: payments } =
    membership && pledgeIds.length
      ? await supabase
          .from('demo_payments')
          .select('pledge_id, status, updated_at')
          .in('pledge_id', pledgeIds)
      : { data: [] };
  const paymentByPledge = new Map(
    (payments ?? []).map((payment) => [payment.pledge_id, payment]),
  );
  const statusMap: Record<
    string,
    { key: string; label: string; tone: 'warning' | 'success' | 'neutral' }
  > = {
    awaiting_organization_signature: {
      key: 'needs-signature',
      label: '기부처 서명 필요',
      tone: 'warning',
    },
    signed: { key: 'completed', label: '양측 서명 완료', tone: 'success' },
    declined: { key: 'closed', label: '거절됨', tone: 'neutral' },
    cancelled: { key: 'closed', label: '취소됨', tone: 'neutral' },
    expired: { key: 'closed', label: '만료됨', tone: 'neutral' },
  };
  const rows = (pledges ?? []).map((pledge) => {
    const payment = paymentByPledge.get(pledge.id);
    const mapped = statusMap[pledge.status] ?? {
      key: 'waiting',
      label: '상태 확인 필요',
      tone: 'neutral' as const,
    };
    return {
      id: pledge.id,
      title: `${pledge.donor_name} 님 · ${pledge.purpose}`,
      description: `${Number(pledge.amount).toLocaleString('ko-KR')}원 · ${pledge.donation_type} · ${getPaymentStatusPresentation(payment?.status).label}`,
      status:
        pledge.status === 'signed'
          ? `${mapped.label} · ${getPaymentStatusPresentation(payment?.status).label}`
          : mapped.label,
      statusKey: mapped.key,
      tone: mapped.tone,
      href: `/partner/pledges/${pledge.id}`,
      cells: {
        amount: `${Number(pledge.amount).toLocaleString('ko-KR')}원`,
        period: pledge.donation_type,
        receivedAt: new Date(pledge.updated_at).toLocaleDateString('ko-KR'),
      },
    };
  });
  return (
    <ManagementList
      activeStatus={status}
      basePath="/partner/pledges"
      title="기부 약정 관리"
      description="기부자가 서명한 약정을 검토하고 기부처 서명을 진행합니다."
      columns={[
        { key: 'amount', label: '기부 금액', align: 'right' },
        { key: 'period', label: '약정 기간' },
        { key: 'receivedAt', label: '최근 변경' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'needs-signature', label: '기부처 서명 필요' },
        { key: 'revision', label: '수정 요청' },
        { key: 'completed', label: '완료' },
        { key: 'closed', label: '종료' },
      ]}
      rows={rows}
    />
  );
}
