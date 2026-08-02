import { NextResponse } from 'next/server';

import { createModusignClient } from '@/lib/modusign/client';
import { getModusignErrorResponse } from '@/lib/modusign/error-response';
import { applyModusignSnapshot } from '@/lib/modusign/snapshot-sync';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pledgeId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const { pledgeId } = await context.params;
  let role: 'donor' | 'organization' = 'donor';
  try {
    const body = (await request.json()) as { role?: string };
    if (body.role === 'organization') role = 'organization';
  } catch {
    // An empty body uses the donor flow.
  }
  const userClient = await createClient();
  const { data: pledge, error: pledgeError } = await userClient
    .from('pledges')
    .select('id, status, donor_user_id, organization_id')
    .eq('id', pledgeId)
    .maybeSingle();

  if (pledgeError) {
    return NextResponse.json({ code: 'pledge_lookup_failed' }, { status: 503 });
  }

  if (!pledge) {
    return NextResponse.json({ code: 'pledge_not_found' }, { status: 404 });
  }

  if (role === 'donor' && pledge.donor_user_id !== user.id) {
    return NextResponse.json({ code: 'forbidden' }, { status: 403 });
  }

  if (role === 'organization') {
    const { data: membership, error: membershipError } = await userClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', pledge.organization_id)
      .eq('user_id', user.id)
      .in('role', ['owner', 'signer'])
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { code: 'membership_lookup_failed' },
        { status: 503 },
      );
    }
    if (!membership) {
      return NextResponse.json({ code: 'forbidden' }, { status: 403 });
    }
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
    .select('id, provider_document_id, last_synced_at')
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

  const lastSyncedAt = document.last_synced_at
    ? Date.parse(document.last_synced_at)
    : Number.NaN;
  if (Number.isFinite(lastSyncedAt) && Date.now() - lastSyncedAt < 8_000) {
    return NextResponse.json({ status: pledge.status, throttled: true });
  }

  const { data: storedParticipants, error: participantsError } =
    await adminClient
      .from('signature_participants')
      .select('id, provider_participant_id, role, status, signed_at')
      .eq('signature_document_id', document.id);

  if (participantsError) {
    return NextResponse.json(
      { code: 'participant_lookup_failed' },
      { status: 503 },
    );
  }

  try {
    const providerDocument = await createModusignClient().getDocument(
      document.provider_document_id,
    );
    const nextStatus = await applyModusignSnapshot({
      adminClient,
      currentPledgeStatus: pledge.status,
      documentId: document.id,
      providerDocument,
      storedParticipants: storedParticipants || [],
    });

    return NextResponse.json({ status: nextStatus });
  } catch (error) {
    await adminClient
      .from('signature_documents')
      .update({
        sync_status: 'failed',
        last_error_code: 'provider_sync_failed',
      })
      .eq('id', document.id);
    const failure = getModusignErrorResponse(error, 'signature_sync_failed');
    return NextResponse.json(
      { code: failure.code },
      { status: failure.status },
    );
  }
}
