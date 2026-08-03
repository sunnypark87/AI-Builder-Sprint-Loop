import Link from 'next/link';

import { ManagementList } from '@/components/partner/management-list';
import { buttonClassName } from '@/components/ui/button';
import { getOrganizationIds } from '@/lib/organizations/membership';
import { listPartnerDonationDetails } from '@/lib/partner/donation-detail-repository';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

function money(value: number) {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function nextActionHref(
  donationId: string,
  pledgeId: string | null,
  action: 'signature' | 'payment' | 'plan' | 'execution' | 'report' | null,
) {
  if (action === 'signature' || action === 'payment') {
    return pledgeId ? `/partner/pledges/${pledgeId}` : undefined;
  }
  if (action === 'plan') {
    return `/partner/plans/new?donationId=${encodeURIComponent(donationId)}`;
  }
  if (action === 'execution') return '/partner/executions/new';
  if (action === 'report') return '/partner/reports/new';
  return `/partner/donations/${donationId}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'all' } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const memberships = await getOrganizationIds(supabase, user.id);
  if (memberships.error)
    throw new Error('organization_membership_lookup_failed');

  const details = memberships.data.length
    ? await listPartnerDonationDetails(supabase, memberships.data)
    : [];

  return (
    <ManagementList
      activeStatus={status}
      basePath="/partner/donations"
      title="기부 관리"
      description="기부 건별 현재 단계와 다음 처리 업무를 실제 저장 데이터로 확인합니다."
      columns={[
        { key: 'amount', label: '기부 금액', align: 'right' },
        { key: 'nextAction', label: '다음 업무' },
        { key: 'updatedAt', label: '최근 변경' },
      ]}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'needs-signature', label: '서명 필요' },
        { key: 'payment', label: '결제 대기' },
        { key: 'plan', label: '계획 필요' },
        { key: 'executing', label: '집행 중' },
        { key: 'report', label: '보고 필요' },
        { key: 'completed', label: '완료' },
      ]}
      rows={details.map((detail) => {
        const { donation, pledge, progress } = detail;
        const href = nextActionHref(
          donation.id,
          pledge?.id ?? null,
          progress.nextActionKind,
        );
        return {
          id: donation.id,
          title: pledge
            ? `${detail.organizationName} · ${pledge.donor_name} 님 · ${pledge.purpose}`
            : '연결된 약정이 없는 기부',
          description: `${money(donation.amount)} · ${pledge?.donation_type ?? '기부'} `,
          status: progress.label,
          statusKey: progress.key,
          tone: progress.tone,
          href: `/partner/donations/${donation.id}`,
          action: href ? (
            <Link
              className={buttonClassName({ variant: 'secondary' })}
              href={href}
            >
              {progress.nextAction}
            </Link>
          ) : undefined,
          cells: {
            amount: money(donation.amount),
            nextAction: progress.nextAction,
            updatedAt: new Date(
              detail.payment?.updated_at ?? donation.created_at,
            ).toLocaleDateString('ko-KR'),
          },
        };
      })}
    />
  );
}
