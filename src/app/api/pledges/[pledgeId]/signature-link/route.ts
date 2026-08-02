import { NextResponse } from 'next/server';

import { createModusignClient } from '@/lib/modusign/client';
import { getModusignErrorResponse } from '@/lib/modusign/error-response';
import { getModusignRedirectUrl } from '@/lib/modusign/redirect-url';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pledgeId: string }> };
type SignatureRole = 'donor' | 'organization';

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });

  const { pledgeId } = await context.params;
  let role: SignatureRole = 'donor';
  try {
    const body = (await request.json()) as { role?: SignatureRole };
    if (body.role === 'organization') role = body.role;
  } catch {
    // The donor role is the safe default for an empty request body.
  }

  const supabase = await createClient();
  const { data: pledge, error: pledgeError } = await supabase
    .from('pledges')
    .select('id, status, donor_user_id, organization_id')
    .eq('id', pledgeId)
    .maybeSingle();

  if (pledgeError)
    return NextResponse.json({ code: 'pledge_lookup_failed' }, { status: 503 });
  if (!pledge)
    return NextResponse.json({ code: 'pledge_not_found' }, { status: 404 });

  if (role === 'donor' && pledge.donor_user_id !== user.id) {
    return NextResponse.json({ code: 'forbidden' }, { status: 403 });
  }

  if (role === 'organization') {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', pledge.organization_id)
      .eq('user_id', user.id)
      .in('role', ['owner', 'signer'])
      .maybeSingle();
    if (!membership || pledge.status !== 'awaiting_organization_signature') {
      return NextResponse.json(
        { code: 'organization_signature_unavailable' },
        { status: 403 },
      );
    }
  }

  if (role === 'donor' && pledge.status !== 'awaiting_donor_signature') {
    return NextResponse.json(
      { code: 'donor_signature_unavailable' },
      { status: 409 },
    );
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return NextResponse.json(
      { code: 'server_configuration_error' },
      { status: 503 },
    );
  }

  const { data: document, error: documentError } = await adminClient
    .from('signature_documents')
    .select('id, provider_document_id')
    .eq('pledge_id', pledgeId)
    .maybeSingle();
  if (documentError) {
    return NextResponse.json(
      { code: 'signature_lookup_failed' },
      { status: 503 },
    );
  }
  if (!document?.provider_document_id) {
    return NextResponse.json(
      { code: 'signature_not_requested' },
      { status: 409 },
    );
  }

  const { data: participant, error: participantError } = await adminClient
    .from('signature_participants')
    .select('provider_participant_id, status')
    .eq('signature_document_id', document.id)
    .eq('role', role)
    .maybeSingle();
  if (participantError) {
    return NextResponse.json(
      { code: 'participant_lookup_failed' },
      { status: 503 },
    );
  }
  if (
    !participant?.provider_participant_id ||
    participant.status === 'signed'
  ) {
    return NextResponse.json(
      { code: 'signature_already_completed' },
      { status: 409 },
    );
  }

  try {
    const redirectPath =
      role === 'donor'
        ? `/pledges/${pledgeId}/waiting`
        : `/partner/pledges/${pledgeId}`;
    const result = await createModusignClient().getEmbeddedParticipantView(
      document.provider_document_id,
      participant.provider_participant_id,
      getModusignRedirectUrl(redirectPath, process.env.NEXT_PUBLIC_SITE_URL),
    );
    return NextResponse.json({ embeddedUrl: result.embeddedUrl });
  } catch (error) {
    const failure = getModusignErrorResponse(error, 'signature_link_failed');
    return NextResponse.json(
      { code: failure.code },
      { status: failure.status },
    );
  }
}
