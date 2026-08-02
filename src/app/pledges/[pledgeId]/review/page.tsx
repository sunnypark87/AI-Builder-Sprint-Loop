import { notFound, redirect } from 'next/navigation';

import { PledgeReviewWorkspace } from '@/components/pledges/pledge-review-workspace';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export default async function PledgeReviewPage({
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
      'id, status, amount, donation_type, donation_kind, donation_kind_other, donation_designation, purpose, pledge_date, donation_condition, donor_name, donor_address, donor_contact, donor_email, payment_schedule, payment_schedule_other, payment_method, payment_method_other, receipt_requested, receipt_recipient_name, receipt_recipient_address, personal_info_consent, third_party_info_consent, identity_info_consent, donor_identity_number_last4, donor_identity_number_collected_at, version, organizations(name, slug)',
    )
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();
  if (!pledge) notFound();
  if (pledge.status !== 'draft') redirect(`/pledges/${pledgeId}/sign`);

  const { data: chatMessages } = await supabase
    .from('pledge_chat_messages')
    .select('id, role, content, proposed_patch, created_at')
    .eq('pledge_id', pledgeId)
    .order('created_at', { ascending: true });

  const organization = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]
    : pledge.organizations;
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 md:px-6 lg:px-9">
      <p className="text-sm font-medium text-copy-muted">약정서 검토</p>
      <h1 className="mt-2 text-3xl font-bold">기부 약정서를 검토해 주세요</h1>
      <p className="mt-3 text-sm leading-6 text-copy-muted">
        {organization?.name}에 전달될 약정서입니다. 값을 직접 수정한 뒤 서명을
        시작할 수 있습니다.
      </p>
      <PledgeReviewWorkspace
        messages={(chatMessages ?? []).map((message) => ({
          content: message.content,
          createdAt: message.created_at,
          id: message.id,
          proposedPatch: message.proposed_patch ?? undefined,
          role: message.role === 'user' ? 'user' : 'assistant',
        }))}
        pledge={pledge}
      />
    </main>
  );
}
