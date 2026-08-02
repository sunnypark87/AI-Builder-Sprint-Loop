import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StatusIndicator } from '@/components/ui/status-indicator';
import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getPaymentStatusPresentation } from '@/lib/payments/presentation';
import { getPledgeStatusPresentation } from '@/lib/pledges/presentation';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MyDonationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/my-donations');

  const supabase = await createClient();
  const { data: pledges, error } = await supabase
    .from('pledges')
    .select(
      'id, amount, donation_type, purpose, pledge_date, status, updated_at, organizations(name, slug)',
    )
    .eq('donor_user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return <DonationHistoryError />;
  }

  const pledgeIds = (pledges ?? []).map((pledge) => pledge.id);
  const { data: payments } = pledgeIds.length
    ? await supabase
        .from('demo_payments')
        .select('pledge_id, method, status, updated_at')
        .in('pledge_id', pledgeIds)
    : { data: [] };
  const paymentByPledge = new Map(
    (payments ?? []).map((payment) => [payment.pledge_id, payment]),
  );

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-12 md:px-6">
      <p className="text-sm text-copy-muted">기부 약정과 결제 상태</p>
      <h1 className="mt-2 text-3xl font-bold">내 기부</h1>
      <p className="mt-3 text-sm text-copy-muted">
        내가 작성한 약정의 서명 진행과 결제 결과를 확인할 수 있습니다.
      </p>

      {pledges?.length ? (
        <div className="mt-8 grid gap-4">
          {pledges.map((pledge) => {
            const organization = Array.isArray(pledge.organizations)
              ? pledge.organizations[0]
              : pledge.organizations;
            const pledgeStatus = getPledgeStatusPresentation(pledge.status);
            const payment = paymentByPledge.get(pledge.id);
            const paymentStatus = getPaymentStatusPresentation(payment?.status);
            return (
              <Link href={`/my-donations/${pledge.id}`} key={pledge.id}>
                <Card className="p-5 transition-colors hover:bg-panel-muted">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-copy-muted">
                        {organization?.name ?? '기부처'}
                      </p>
                      <h2 className="mt-1 text-lg font-bold">
                        {pledge.purpose}
                      </h2>
                      <p className="mt-2 text-sm text-copy-muted">
                        {pledge.pledge_date} · {pledge.donation_type}
                      </p>
                    </div>
                    <strong className="text-xl">
                      {Number(pledge.amount).toLocaleString('ko-KR')}원
                    </strong>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4">
                    <StatusIndicator tone={pledgeStatus.tone}>
                      {pledgeStatus.label}
                    </StatusIndicator>
                    <StatusIndicator tone={paymentStatus.tone}>
                      {paymentStatus.label}
                    </StatusIndicator>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="mt-8 p-10 text-center">
          <h2 className="text-lg font-bold">아직 기부 약정이 없습니다.</h2>
          <p className="mt-2 text-sm text-copy-muted">
            기부처를 둘러보고 첫 약정을 시작해 보세요.
          </p>
          <Link
            className={buttonClassName({ className: 'mt-6' })}
            href="/organizations"
          >
            기부처 둘러보기
          </Link>
        </Card>
      )}
    </main>
  );
}

function DonationHistoryError() {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-16 md:px-6">
      <h1 className="text-2xl font-bold">기부 내역을 불러오지 못했어요.</h1>
      <p className="mt-3 text-sm text-copy-muted">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
      </p>
    </main>
  );
}
