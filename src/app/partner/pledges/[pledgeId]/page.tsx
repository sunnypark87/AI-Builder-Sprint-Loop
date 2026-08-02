import { notFound, redirect } from 'next/navigation';

import { OrganizationPledgeCompletionPanel } from '@/components/partner/organization-pledge-completion-panel';
import { OrganizationSigningPanel } from '@/components/partner/organization-signing-panel';
import { PageHeader } from '@/components/partner/page-header';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function PartnerPledgePage({
  params,
}: {
  params: Promise<{ pledgeId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { pledgeId } = await params;
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) notFound();
  const { data: pledge } = await supabase
    .from('pledges')
    .select(
      'id, status, amount, donation_type, purpose, pledge_date, donation_condition, donor_name, donor_address, donor_contact, donor_email, receipt_requested, organizations(name, slug)',
    )
    .eq('id', pledgeId)
    .eq('organization_id', membership.organization_id)
    .maybeSingle();
  if (!pledge) notFound();
  const { data: payment } = await supabase
    .from('demo_payments')
    .select('status, updated_at')
    .eq('pledge_id', pledgeId)
    .maybeSingle();

  const organization = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]
    : pledge.organizations;
  const available =
    pledge.status === 'awaiting_organization_signature' &&
    membership.role !== 'viewer';
  return (
    <div className="max-w-[960px]">
      <PageHeader
        context="약정 검토"
        title={`${pledge.donor_name} 님의 기부 약정`}
        description={
          pledge.status === 'signed'
            ? '양측 서명이 완료된 약정과 결제 상태를 확인합니다.'
            : '기부자가 서명한 약정 내용을 확인하고 기부처 서명을 진행합니다.'
        }
      />
      <Card className="mt-8 overflow-hidden border-2 border-copy">
        <div className="border-b-4 border-copy px-8 py-7 text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-copy-muted">
            기 부 약 정 서
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            {organization?.name} 정기 기부 약정
          </h2>
        </div>
        <dl className="grid gap-4 px-8 py-8 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-copy-muted">기부자</dt>
            <dd className="mt-1 font-bold">{pledge.donor_name}</dd>
          </div>
          <div>
            <dt className="text-copy-muted">기부 금액</dt>
            <dd className="mt-1 font-bold">
              {Number(pledge.amount).toLocaleString('ko-KR')}원
            </dd>
          </div>
          <div>
            <dt className="text-copy-muted">기부 유형</dt>
            <dd className="mt-1 font-bold">{pledge.donation_type}</dd>
          </div>
          <div>
            <dt className="text-copy-muted">약정일</dt>
            <dd className="mt-1 font-bold">{pledge.pledge_date}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-copy-muted">기부 목적</dt>
            <dd className="mt-1 leading-6">{pledge.purpose}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-copy-muted">집행·공개 조건</dt>
            <dd className="mt-1 leading-6">
              {pledge.donation_condition || '별도 조건 없음'}
            </dd>
          </div>
        </dl>
      </Card>
      {pledge.status === 'signed' ? (
        <OrganizationPledgeCompletionPanel payment={payment} />
      ) : (
        <OrganizationSigningPanel pledgeId={pledge.id} available={available} />
      )}
    </div>
  );
}
