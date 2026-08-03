import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { StatusIndicator } from '@/components/ui/status-indicator';
import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getPaymentStatusPresentation } from '@/lib/payments/presentation';
import { getPledgeStatusPresentation } from '@/lib/pledges/presentation';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function MyDonationDetailPage({
  params,
}: {
  params: Promise<{ pledgeId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { pledgeId } = await params;
  const supabase = await createClient();
  const { data: pledge } = await supabase
    .from('pledges')
    .select(
      'id, amount, donation_type, purpose, pledge_date, status, updated_at, organizations(name, slug)',
    )
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();
  if (!pledge) notFound();

  const { data: payment } = await supabase
    .from('demo_payments')
    .select('method, status, updated_at')
    .eq('pledge_id', pledgeId)
    .maybeSingle();
  const { data: reports } = await supabase
    .from('donation_reports')
    .select('id,title,published_at')
    .eq('pledge_id', pledgeId)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  const organization = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]
    : pledge.organizations;
  const pledgeStatus = getPledgeStatusPresentation(pledge.status);
  const paymentStatus = getPaymentStatusPresentation(payment?.status);

  return (
    <main className="mx-auto max-w-[820px] px-4 py-12 md:px-6">
      <Link
        className="text-sm text-copy-muted underline underline-offset-4"
        href="/my-donations"
      >
        내 기부로 돌아가기
      </Link>
      <p className="mt-8 text-sm text-copy-muted">기부 약정 상세</p>
      <h1 className="mt-2 text-3xl font-bold">
        {organization?.name ?? '기부처'}
      </h1>
      <p className="mt-2 text-copy-muted">{pledge.purpose}</p>

      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-copy-muted">약정 금액</p>
            <strong className="mt-1 block text-2xl">
              {Number(pledge.amount).toLocaleString('ko-KR')}원
            </strong>
          </div>
          <div className="grid gap-2 text-right">
            <StatusIndicator tone={pledgeStatus.tone}>
              {pledgeStatus.label}
            </StatusIndicator>
            <StatusIndicator tone={paymentStatus.tone}>
              {paymentStatus.label}
            </StatusIndicator>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-copy-muted">약정일</dt>
            <dd className="mt-1 font-medium">{pledge.pledge_date}</dd>
          </div>
          <div>
            <dt className="text-copy-muted">기부 유형</dt>
            <dd className="mt-1 font-medium">{pledge.donation_type}</dd>
          </div>
          <div>
            <dt className="text-copy-muted">최근 변경</dt>
            <dd className="mt-1 font-medium">
              {new Date(pledge.updated_at).toLocaleDateString('ko-KR')}
            </dd>
          </div>
          {payment ? (
            <div>
              <dt className="text-copy-muted">결제 수단</dt>
              <dd className="mt-1 font-medium">{payment.method}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        {getNextAction(pledge.status, payment?.status, pledgeId)}
      </div>

      {(reports ?? []).length > 0 ? (
        <section className="mt-10" aria-labelledby="published-reports-heading">
          <h2 className="text-xl font-bold" id="published-reports-heading">
            발행된 집행 보고서
          </h2>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {(reports ?? []).map((report) => (
              <Link
                className="flex min-h-16 items-center justify-between gap-4 py-4 hover:text-accent-strong"
                href={`/my-donations/${pledgeId}/reports/${report.id}`}
                key={report.id}
              >
                <span className="font-bold">{report.title}</span>
                <span className="text-sm text-copy-muted">
                  {new Date(report.published_at as string).toLocaleDateString(
                    'ko-KR',
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function getNextAction(
  pledgeStatus: string,
  paymentStatus: string | undefined,
  pledgeId: string,
) {
  if (pledgeStatus === 'draft') {
    return (
      <Link className={buttonClassName()} href={`/pledges/${pledgeId}/review`}>
        약정 계속 작성
      </Link>
    );
  }
  if (pledgeStatus === 'awaiting_donor_signature') {
    return (
      <Link className={buttonClassName()} href={`/pledges/${pledgeId}/sign`}>
        서명하기
      </Link>
    );
  }
  if (pledgeStatus === 'awaiting_organization_signature') {
    return (
      <Link
        className={buttonClassName({ variant: 'secondary' })}
        href={`/pledges/${pledgeId}/waiting`}
      >
        서명 상태 확인
      </Link>
    );
  }
  if (pledgeStatus === 'signed' && !paymentStatus) {
    return (
      <Link
        className={buttonClassName()}
        href={`/donations/${pledgeId}/payment`}
      >
        결제하기
      </Link>
    );
  }
  if (pledgeStatus === 'signed') {
    return (
      <Link
        className={buttonClassName({ variant: 'secondary' })}
        href={`/donations/${pledgeId}/payment/result`}
      >
        결제 상태 확인
      </Link>
    );
  }
  return null;
}
