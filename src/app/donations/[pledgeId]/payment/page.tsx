import { notFound, redirect } from 'next/navigation';

import { PledgePaymentForm } from '@/components/donations/pledge-payment-form';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function PledgePaymentPage({
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
    .select('id, status, amount, purpose, organizations(name)')
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();
  if (!pledge) notFound();
  if (pledge.status !== 'signed') redirect(`/pledges/${pledgeId}/waiting`);
  const organization = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]
    : pledge.organizations;
  return (
    <PledgePaymentForm
      pledge={{
        id: pledge.id,
        amount: pledge.amount,
        purpose: pledge.purpose,
        organizationName: organization?.name ?? '기부처',
      }}
    />
  );
}
