import { after, NextResponse } from 'next/server';

import { createModusignClient } from '@/lib/modusign/client';
import { applyModusignSnapshot } from '@/lib/modusign/snapshot-sync';
import {
  MODUSIGN_WEBHOOK_SECRET_HEADER,
  hasValidModusignWebhookSecret,
} from '@/lib/modusign/webhook-security';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (
    !hasValidModusignWebhookSecret(
      request.headers.get(MODUSIGN_WEBHOOK_SECRET_HEADER),
    )
  ) {
    return NextResponse.json({ code: 'webhook_unauthorized' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_json' }, { status: 400 });
  }

  const event = parseWebhookEvent(body, request.headers);

  if (!event) {
    return NextResponse.json(
      { code: 'invalid_webhook_payload' },
      { status: 400 },
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

  const { data: claimResult, error: eventClaimError } = await adminClient.rpc(
    'claim_modusign_webhook_event',
    {
      p_event_type: event.eventType,
      p_provider_document_id: event.documentId,
      p_provider_event_id: event.eventId,
    },
  );

  if (eventClaimError) {
    return NextResponse.json(
      { code: 'webhook_event_claim_failed' },
      { status: 503 },
    );
  }

  const claimState = getClaimState(claimResult);
  if (claimState === 'processed') {
    return NextResponse.json({ status: 'duplicate' });
  }
  if (claimState === 'in_progress') {
    return NextResponse.json({ status: 'in_progress' }, { status: 202 });
  }
  if (claimState !== 'claimed') {
    return NextResponse.json(
      { code: 'webhook_event_claim_failed' },
      { status: 503 },
    );
  }

  after(() => processClaimedWebhookEvent(event));

  return NextResponse.json({ status: 'accepted' }, { status: 202 });
}

type WebhookEvent = {
  documentId: string;
  eventId: string;
  eventType: string;
};

async function processClaimedWebhookEvent(event: WebhookEvent) {
  const adminClient = createAdminClient();
  const { data: document, error: documentError } = await adminClient
    .from('signature_documents')
    .select('id, pledge_id, provider_document_id')
    .eq('provider_document_id', event.documentId)
    .maybeSingle();

  if (documentError) {
    await releaseWebhookClaim(event.eventId, 'signature_lookup_failed');
    return;
  }

  if (!document) {
    await adminClient
      .from('modusign_webhook_events')
      .update({
        processing_error_code: 'unknown_document',
        processing_started_at: null,
      })
      .eq('provider_event_id', event.eventId);
    return;
  }

  const { data: pledge, error: pledgeError } = await adminClient
    .from('pledges')
    .select('id, status')
    .eq('id', document.pledge_id)
    .single();
  const { data: participants, error: participantsError } = await adminClient
    .from('signature_participants')
    .select('id, provider_participant_id, role, status, signed_at')
    .eq('signature_document_id', document.id);

  if (pledgeError || participantsError || !pledge) {
    await adminClient
      .from('modusign_webhook_events')
      .update({
        processing_error_code: 'internal_record_missing',
        processing_started_at: null,
      })
      .eq('provider_event_id', event.eventId);
    return;
  }

  try {
    const providerDocument = await createModusignClient().getDocument(
      event.documentId,
    );
    await applyModusignSnapshot({
      adminClient,
      currentPledgeStatus: pledge.status,
      documentId: document.id,
      eventId: event.eventId,
      providerDocument,
      storedParticipants: participants || [],
    });
  } catch (error) {
    await adminClient
      .from('modusign_webhook_events')
      .update({
        processing_error_code:
          error instanceof Error &&
          error.message === 'invalid_provider_transition'
            ? 'invalid_provider_transition'
            : 'provider_sync_failed',
        processing_started_at: null,
      })
      .eq('provider_event_id', event.eventId);
    await adminClient
      .from('signature_documents')
      .update({
        sync_status: 'failed',
        last_error_code: 'provider_sync_failed',
      })
      .eq('id', document.id);
  }
}

async function releaseWebhookClaim(eventId: string, errorCode: string) {
  const adminClient = createAdminClient();
  await adminClient
    .from('modusign_webhook_events')
    .update({
      processing_error_code: errorCode,
      processing_started_at: null,
    })
    .eq('provider_event_id', eventId);
}

function getClaimState(value: unknown) {
  if (value === 'claimed' || value === 'in_progress' || value === 'processed') {
    return value;
  }

  if (Array.isArray(value) && value.length === 1) {
    return getClaimState(value[0]);
  }

  if (
    isRecord(value) &&
    (value.state === 'claimed' ||
      value.state === 'in_progress' ||
      value.state === 'processed')
  ) {
    return value.state;
  }

  return null;
}

function parseWebhookEvent(
  value: unknown,
  headers: Headers,
): { documentId: string; eventId: string; eventType: string } | null {
  if (!isRecord(value)) {
    return null;
  }

  const documentId = firstString(
    value.documentId,
    isRecord(value.document) ? value.document.id : undefined,
    isRecord(value.data) ? value.data.documentId : undefined,
  );
  const nestedEvent = isRecord(value.event) ? value.event : undefined;
  const eventId = firstString(
    value.eventId,
    value.id,
    headers.get('x-modusign-event-id'),
  );
  const eventType = firstString(value.eventType, value.type, nestedEvent?.type);

  if (!documentId || !eventType) {
    return null;
  }

  return {
    documentId,
    eventId: eventId || `modusign:${documentId}:${eventType}`,
    eventType,
  };
}

function firstString(...values: unknown[]) {
  return values.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
