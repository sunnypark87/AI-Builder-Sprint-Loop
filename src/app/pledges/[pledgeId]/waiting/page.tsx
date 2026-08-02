import { notFound, redirect } from 'next/navigation';

import { PledgeStatusSyncButton } from '@/components/pledges/pledge-status-sync-button';
import Link from 'next/link';

import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getPledgeStatusPresentation } from '@/lib/pledges/presentation';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function PledgeWaitingPage({
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
    .select('id, status, organizations(name)')
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();
  if (!pledge) notFound();
  const signed = pledge.status === 'signed';
  const pledgeStatus = getPledgeStatusPresentation(pledge.status);
  const organizationName = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]?.name
    : undefined;
  return (
    <main className="mx-auto max-w-[720px] px-4 py-12 md:px-6">
      <p className="text-sm text-copy-muted">약정 진행 상태</p>
      <h1 className="mt-2 text-3xl font-bold">
        {signed
          ? '약정이 최종 체결됐어요'
          : `${organizationName ?? '기부재단'}의 서명을 기다리고 있어요`}
      </h1>
      <Card className="mt-8 p-6">
        <p className="text-sm leading-6 text-copy-secondary">
          {signed
            ? '양측 서명이 확인되었습니다. 이제 결제를 진행할 수 있습니다.'
            : pledge.status === 'awaiting_donor_signature'
              ? '모두싸인이 기부자 서명 처리를 완료하는 데 잠시 시간이 걸릴 수 있어요. 서명 상태를 확인하면 자동으로 재조회합니다.'
              : '기부재단이 모두싸인에서 약정서를 확인하고 서명하면 다음 단계가 열립니다.'}
        </p>
        <p className="mt-4 text-sm font-bold">
          현재 상태: {pledgeStatus.label}
        </p>
      </Card>
      <div className="mt-8 flex justify-end gap-2">
        {!signed ? <PledgeStatusSyncButton pledgeId={pledgeId} /> : null}
        <Link
          className={buttonClassName({ variant: 'secondary' })}
          href="/my-donations"
        >
          내 기부에서 확인
        </Link>
        {signed ? (
          <Link
            className={buttonClassName()}
            href={`/donations/${pledgeId}/payment`}
          >
            결제 진행
          </Link>
        ) : null}
      </div>
    </main>
  );
}
