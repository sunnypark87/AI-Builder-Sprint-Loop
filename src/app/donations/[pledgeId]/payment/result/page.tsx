import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { getPaymentStatusPresentation } from '@/lib/payments/presentation';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function PledgePaymentResultPage({
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
    .select('id, amount, organizations(name)')
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();
  if (!pledge) notFound();
  const { data: payment } = await supabase
    .from('demo_payments')
    .select('method, status, updated_at')
    .eq('pledge_id', pledgeId)
    .maybeSingle();
  if (!payment) redirect(`/donations/${pledgeId}/payment`);
  const paymentStatus = getPaymentStatusPresentation(payment.status);
  const organization = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]
    : pledge.organizations;
  return (
    <main className="mx-auto max-w-[680px] px-4 py-16 text-center">
      <StatusIndicator tone={paymentStatus.tone}>
        {paymentStatus.label}
      </StatusIndicator>
      <h1 className="mt-2 text-3xl font-bold">결제 처리 결과</h1>
      <Card className="mt-8 p-5 text-left">
        <div className="flex justify-between text-sm">
          <span className="text-copy-muted">기부처</span>
          <strong>{organization?.name ?? '기부처'}</strong>
        </div>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-copy-muted">금액</span>
          <strong>{Number(pledge.amount).toLocaleString('ko-KR')}원</strong>
        </div>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-copy-muted">상태</span>
          <StatusIndicator tone={paymentStatus.tone}>
            {paymentStatus.label}
          </StatusIndicator>
        </div>
      </Card>
      <Link
        className={buttonClassName({ className: 'mt-8' })}
        href="/my-donations"
      >
        내 기부로 돌아가기
      </Link>
    </main>
  );
}
