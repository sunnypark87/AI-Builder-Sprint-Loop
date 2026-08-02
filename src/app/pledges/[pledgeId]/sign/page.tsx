import { notFound, redirect } from 'next/navigation';

import { DonorSigningPanel } from '@/components/pledges/donor-signing-panel';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function PledgeSignPage({
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
    .select('id, status')
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();
  if (!pledge) notFound();
  if (pledge.status !== 'draft' && pledge.status !== 'awaiting_donor_signature')
    redirect(`/pledges/${pledgeId}/waiting`);
  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 md:px-6">
      <h1 className="mt-8 text-3xl font-bold">기부자 전자서명</h1>
      <DonorSigningPanel pledgeId={pledgeId} />
    </main>
  );
}
