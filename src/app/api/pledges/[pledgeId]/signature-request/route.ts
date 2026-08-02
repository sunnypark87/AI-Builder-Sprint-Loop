import { NextResponse } from 'next/server';

import { createModusignClient } from '@/lib/modusign/client';
import { getModusignErrorResponse } from '@/lib/modusign/error-response';
import { buildDonationSignatureRequest } from '@/lib/modusign/request-builder';
import { MODUSIGN_DONATION_TEMPLATE_ID } from '@/lib/modusign/template-mapping';
import { canCreateSignatureRequest } from '@/lib/pledges/status';
import { getModusignConfig } from '@/lib/modusign/config';
import { decryptIdentityNumber } from '@/lib/pledges/identity-number';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const SIGNATURE_REQUEST_LEASE_MS = 5 * 60 * 1000;

type RouteContext = { params: Promise<{ pledgeId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const { pledgeId } = await context.params;
  const userClient = await createClient();
  const { data: pledge, error: pledgeError } = await userClient
    .from('pledges')
    .select('*')
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();

  if (pledgeError) {
    return NextResponse.json({ code: 'pledge_lookup_failed' }, { status: 503 });
  }

  if (!pledge) {
    return NextResponse.json({ code: 'pledge_not_found' }, { status: 404 });
  }

  if (!user.email) {
    return NextResponse.json(
      { code: 'donor_signer_email_missing' },
      { status: 409 },
    );
  }

  if (
    !canCreateSignatureRequest(pledge.status) &&
    pledge.status !== 'awaiting_donor_signature'
  ) {
    return NextResponse.json({ code: 'invalid_pledge_state' }, { status: 409 });
  }

  const requiredFields = [
    ['donor_name', pledge.donor_name],
    ['donor_address', pledge.donor_address],
    ['donor_contact', pledge.donor_contact],
    ['donor_identity_number', pledge.donor_identity_number_ciphertext],
    ['donor_identity_number_iv', pledge.donor_identity_number_iv],
    ['donor_identity_number_auth_tag', pledge.donor_identity_number_auth_tag],
    ['amount', pledge.amount],
    ['donation_type', pledge.donation_type],
    ['purpose', pledge.purpose],
    ['pledge_date', pledge.pledge_date],
    ['donation_kind', pledge.donation_kind],
    ['donation_designation', pledge.donation_designation],
    ['payment_schedule', pledge.payment_schedule],
    ['payment_method', pledge.payment_method],
  ] as const;
  const missingFields: string[] = requiredFields
    .filter(
      ([, value]) => value === null || value === undefined || value === '',
    )
    .map(([field]) => field);
  if (pledge.donation_kind === 'other' && !pledge.donation_kind_other?.trim()) {
    missingFields.push('donation_kind_other');
  }
  if (
    pledge.payment_schedule === 'other' &&
    !pledge.payment_schedule_other?.trim()
  ) {
    missingFields.push('payment_schedule_other');
  }
  if (
    pledge.payment_method === 'other' &&
    !pledge.payment_method_other?.trim()
  ) {
    missingFields.push('payment_method_other');
  }
  if (pledge.personal_info_consent !== true) {
    missingFields.push('personal_info_consent');
  }
  if (pledge.third_party_info_consent !== true) {
    missingFields.push('third_party_info_consent');
  }
  if (pledge.identity_info_consent !== true) {
    missingFields.push('identity_info_consent');
  }
  if (missingFields.length) {
    return NextResponse.json(
      { code: 'pledge_incomplete', fields: missingFields },
      { status: 409 },
    );
  }

  let identityNumber: string;
  try {
    identityNumber = decryptIdentityNumber({
      authTag: pledge.donor_identity_number_auth_tag,
      ciphertext: pledge.donor_identity_number_ciphertext,
      iv: pledge.donor_identity_number_iv,
    });
  } catch {
    return NextResponse.json(
      { code: 'identity_number_unavailable' },
      { status: 503 },
    );
  }

  let adminClient;
  let modusignConfig;

  try {
    adminClient = createAdminClient();
    modusignConfig = getModusignConfig();
  } catch {
    return NextResponse.json(
      { code: 'server_configuration_error' },
      { status: 503 },
    );
  }

  const { data: existingDocument, error: existingError } = await adminClient
    .from('signature_documents')
    .select(
      'id, provider_document_id, sync_status, sync_started_at, last_error_code',
    )
    .eq('pledge_id', pledgeId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { code: 'signature_lookup_failed' },
      { status: 503 },
    );
  }

  if (
    existingDocument?.provider_document_id &&
    existingDocument.sync_status === 'idle'
  ) {
    return NextResponse.json(
      { documentId: existingDocument.provider_document_id, status: 'existing' },
      { status: 200 },
    );
  }

  if (existingDocument?.provider_document_id) {
    let linkedDocument;
    try {
      linkedDocument = await createModusignClient().getDocument(
        existingDocument.provider_document_id,
      );
    } catch (error) {
      const failure = getModusignErrorResponse(
        error,
        'signature_reconciliation_failed',
      );
      return NextResponse.json(
        { code: failure.code },
        { status: failure.status },
      );
    }

    const donorParticipant = linkedDocument.participants.find(
      (participant) => participant.signingOrder === 1,
    );
    const organizationParticipant = linkedDocument.participants.find(
      (participant) => participant.signingOrder === 2,
    );
    if (
      !donorParticipant?.id ||
      donorParticipant.type !== 'SIGNER' ||
      !organizationParticipant?.id ||
      organizationParticipant.type !== 'SIGNER'
    ) {
      return NextResponse.json(
        { code: 'signature_reconciliation_required' },
        { status: 409 },
      );
    }

    const { error: finalizeError } = await adminClient.rpc(
      'finalize_modusign_signature_request',
      {
        p_donor_participant_id: donorParticipant.id,
        p_organization_participant_id: organizationParticipant.id,
        p_provider_document_id: linkedDocument.id,
        p_provider_status: linkedDocument.status,
        p_signature_document_id: existingDocument.id,
      },
    );
    if (finalizeError) {
      await adminClient
        .from('signature_documents')
        .update({
          last_error_code: 'internal_signature_finalize_failed',
          sync_status: 'reconciliation_required',
        })
        .eq('id', existingDocument.id);
      return NextResponse.json(
        { code: 'signature_reconciliation_failed' },
        { status: 503 },
      );
    }

    return NextResponse.json({
      documentId: linkedDocument.id,
      status: 'existing',
    });
  }

  if (pledge.status === 'awaiting_donor_signature' && !existingDocument) {
    return NextResponse.json(
      { code: 'signature_document_missing' },
      { status: 409 },
    );
  }

  if (existingDocument?.sync_status === 'syncing') {
    const startedAt = existingDocument.sync_started_at
      ? Date.parse(existingDocument.sync_started_at)
      : Number.NaN;
    const isStale =
      !Number.isFinite(startedAt) ||
      Date.now() - startedAt > SIGNATURE_REQUEST_LEASE_MS;

    if (!isStale) {
      return NextResponse.json(
        { code: 'signature_request_in_progress' },
        { status: 202 },
      );
    }

    await adminClient
      .from('signature_documents')
      .update({
        last_error_code: 'signature_request_lease_expired',
        sync_status: 'reconciliation_required',
      })
      .eq('id', existingDocument.id)
      .eq('sync_status', 'syncing');

    return NextResponse.json(
      { code: 'signature_reconciliation_required' },
      { status: 409 },
    );
  }

  let reclaimedDocument: {
    id: string;
    provider_document_id: string | null;
    sync_status: string;
  } | null = null;

  if (
    existingDocument &&
    (existingDocument.sync_status === 'reconciliation_required' ||
      existingDocument.last_error_code === 'modusign_timeout')
  ) {
    let matchingDocuments;
    try {
      matchingDocuments = await createModusignClient().findDocumentsByMetadata({
        pledge_id: pledgeId,
      });
    } catch (error) {
      const failure = getModusignErrorResponse(
        error,
        'signature_reconciliation_failed',
      );
      return NextResponse.json(
        { code: failure.code },
        { status: failure.status },
      );
    }

    if (matchingDocuments.length > 1) {
      return NextResponse.json(
        { code: 'signature_reconciliation_required' },
        { status: 409 },
      );
    }

    const recoveredDocument = matchingDocuments[0];
    if (recoveredDocument) {
      const donorParticipant = recoveredDocument.participants.find(
        (participant) => participant.signingOrder === 1,
      );
      const organizationParticipant = recoveredDocument.participants.find(
        (participant) => participant.signingOrder === 2,
      );
      if (
        !donorParticipant?.id ||
        donorParticipant.type !== 'SIGNER' ||
        !organizationParticipant?.id ||
        organizationParticipant.type !== 'SIGNER'
      ) {
        return NextResponse.json(
          { code: 'signature_reconciliation_required' },
          { status: 409 },
        );
      }

      const { error: attachError } = await adminClient
        .from('signature_documents')
        .update({ provider_document_id: recoveredDocument.id })
        .eq('id', existingDocument.id)
        .is('provider_document_id', null);
      if (attachError) {
        return NextResponse.json(
          { code: 'signature_reconciliation_failed' },
          { status: 503 },
        );
      }

      const { error: finalizeError } = await adminClient.rpc(
        'finalize_modusign_signature_request',
        {
          p_donor_participant_id: donorParticipant.id,
          p_organization_participant_id: organizationParticipant.id,
          p_provider_document_id: recoveredDocument.id,
          p_provider_status: recoveredDocument.status,
          p_signature_document_id: existingDocument.id,
        },
      );
      if (finalizeError) {
        return NextResponse.json(
          { code: 'signature_reconciliation_failed' },
          { status: 503 },
        );
      }

      return NextResponse.json({
        documentId: recoveredDocument.id,
        status: 'existing',
      });
    }

    const startedAt = existingDocument.sync_started_at
      ? Date.parse(existingDocument.sync_started_at)
      : Number.NaN;
    const retryWindowElapsed =
      !Number.isFinite(startedAt) ||
      Date.now() - startedAt > SIGNATURE_REQUEST_LEASE_MS;
    if (!retryWindowElapsed) {
      return NextResponse.json(
        { code: 'signature_reconciliation_in_progress' },
        { status: 202 },
      );
    }

    const { data, error } = await adminClient
      .from('signature_documents')
      .update({
        last_error_code: null,
        sync_started_at: new Date().toISOString(),
        sync_status: 'syncing',
      })
      .eq('id', existingDocument.id)
      .eq('sync_status', existingDocument.sync_status)
      .select('id, provider_document_id, sync_status')
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { code: 'signature_claim_failed' },
        { status: 503 },
      );
    }
    reclaimedDocument = data;
  }

  if (
    !reclaimedDocument &&
    existingDocument?.sync_status === 'failed' &&
    isRetryableSignatureRequestError(existingDocument.last_error_code)
  ) {
    const { data, error } = await adminClient
      .from('signature_documents')
      .update({
        last_error_code: null,
        sync_started_at: new Date().toISOString(),
        sync_status: 'syncing',
      })
      .eq('id', existingDocument.id)
      .eq('sync_status', 'failed')
      .select('id, provider_document_id, sync_status')
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { code: 'signature_claim_failed' },
        { status: 503 },
      );
    }
    reclaimedDocument = data;
  }

  const { data: signer, error: signerError } = await adminClient
    .from('organization_members')
    .select('signer_email, signer_name, role, user_id')
    .eq('organization_id', pledge.organization_id)
    .in('role', ['owner', 'signer'])
    .eq('is_primary_signer', true)
    .maybeSingle();

  if (signerError || !signer?.signer_name || !signer.signer_email) {
    return NextResponse.json(
      { code: 'organization_signer_missing' },
      { status: 409 },
    );
  }

  const { data: signerAccount, error: signerAccountError } =
    await adminClient.auth.admin.getUserById(signer.user_id);
  if (
    signerAccountError ||
    !signerAccount.user?.email ||
    signerAccount.user.email.toLowerCase() !== signer.signer_email.toLowerCase()
  ) {
    return NextResponse.json(
      { code: 'organization_signer_account_mismatch' },
      { status: 409 },
    );
  }

  const idempotencyKey = `pledge:${pledgeId}:signature-request`;
  const { data: claimedDocument, error: claimError } = reclaimedDocument
    ? { data: reclaimedDocument, error: null }
    : await adminClient.rpc('claim_modusign_signature_request', {
        p_donor_user_id: user.id,
        p_expected_version: pledge.version,
        p_idempotency_key: idempotencyKey,
        p_pledge_id: pledgeId,
        p_sync_started_at: new Date().toISOString(),
        p_template_id:
          modusignConfig.templateId || MODUSIGN_DONATION_TEMPLATE_ID,
      });

  if (claimError) {
    if (
      claimError.message === 'pledge_version_changed' ||
      claimError.message === 'pledge_state_changed'
    ) {
      return NextResponse.json({ code: 'pledge_changed' }, { status: 409 });
    }
    const { data: existingClaim } = await adminClient
      .from('signature_documents')
      .select('id, provider_document_id, sync_status, last_error_code')
      .eq('pledge_id', pledgeId)
      .maybeSingle();
    if (
      existingClaim?.provider_document_id &&
      existingClaim.sync_status === 'idle'
    ) {
      return NextResponse.json(
        { documentId: existingClaim.provider_document_id, status: 'existing' },
        { status: 200 },
      );
    }
    if (existingClaim?.provider_document_id) {
      return NextResponse.json(
        { code: 'signature_reconciliation_required' },
        { status: 409 },
      );
    }
    if (existingClaim?.sync_status === 'syncing') {
      return NextResponse.json(
        { code: 'signature_request_in_progress' },
        { status: 202 },
      );
    }
    return NextResponse.json(
      { code: 'signature_reconciliation_required' },
      { status: 409 },
    );
  }

  const signatureDocument = claimedDocument;

  if (!signatureDocument) {
    return NextResponse.json(
      { code: 'signature_claim_failed' },
      { status: 503 },
    );
  }

  const requestBody = buildDonationSignatureRequest(
    {
      address: pledge.donor_address,
      amount: Number(pledge.amount),
      contact: pledge.donor_contact,
      donorEmail: user.email,
      donorName: pledge.donor_name,
      donationCondition: pledge.donation_condition || undefined,
      donationDesignation: pledge.donation_designation || undefined,
      donationKind: pledge.donation_kind || undefined,
      donationKindOther: pledge.donation_kind_other || undefined,
      donationType: pledge.donation_type,
      identityInfoConsent: pledge.identity_info_consent ?? undefined,
      identityNumber,
      id: pledgeId,
      organizationSlug: pledge.organization_id,
      paymentMethod: pledge.payment_method || undefined,
      paymentMethodOther: pledge.payment_method_other || undefined,
      paymentSchedule: pledge.payment_schedule || undefined,
      paymentScheduleOther: pledge.payment_schedule_other || undefined,
      personalInfoConsent: pledge.personal_info_consent ?? undefined,
      pledgeDate: pledge.pledge_date,
      purpose: pledge.purpose,
      receiptRecipientAddress: pledge.receipt_requested
        ? pledge.donor_address
        : undefined,
      receiptRecipientName: pledge.receipt_requested
        ? pledge.donor_name
        : undefined,
      receiptRequested: Boolean(pledge.receipt_requested),
      thirdPartyInfoConsent: pledge.third_party_info_consent ?? undefined,
    },
    { email: signerAccount.user.email, name: signer.signer_name },
    modusignConfig.templateId,
  );

  let providerDocumentCreated = false;
  try {
    const document =
      await createModusignClient().createDocumentWithTemplate(requestBody);
    providerDocumentCreated = true;
    const donorParticipant = document.participants.find(
      (participant) => participant.signingOrder === 1,
    );
    const organizationParticipant = document.participants.find(
      (participant) => participant.signingOrder === 2,
    );
    if (
      !donorParticipant?.id ||
      donorParticipant.type !== 'SIGNER' ||
      !organizationParticipant?.id ||
      organizationParticipant.type !== 'SIGNER'
    ) {
      throw new Error('provider_participants_missing');
    }

    const { error: attachError } = await adminClient
      .from('signature_documents')
      .update({
        provider_document_id: document.id,
      })
      .eq('id', signatureDocument.id)
      .is('provider_document_id', null);

    if (attachError) {
      throw new Error('internal_document_attach_failed');
    }

    const { error: finalizeError } = await adminClient.rpc(
      'finalize_modusign_signature_request',
      {
        p_donor_participant_id: donorParticipant.id,
        p_organization_participant_id: organizationParticipant.id,
        p_provider_document_id: document.id,
        p_provider_status: document.status,
        p_signature_document_id: signatureDocument.id,
      },
    );

    if (finalizeError) {
      throw new Error('internal_signature_finalize_failed');
    }

    return NextResponse.json(
      { documentId: document.id, status: 'awaiting_donor_signature' },
      { status: 201 },
    );
  } catch (error) {
    const failure = getModusignErrorResponse(error, 'signature_request_failed');
    await adminClient
      .from('signature_documents')
      .update({
        sync_status:
          providerDocumentCreated ||
          failure.code === 'modusign_timeout' ||
          failure.code === 'modusign_invalid_response'
            ? 'reconciliation_required'
            : 'failed',
        last_error_code: failure.code,
      })
      .eq('pledge_id', pledgeId);
    return NextResponse.json(
      { code: failure.code },
      { status: failure.status },
    );
  }
}

function isRetryableSignatureRequestError(code: string | null) {
  return (
    code === 'modusign_auth_failed' ||
    code === 'modusign_invalid_response' ||
    code === 'modusign_rate_limited' ||
    code === 'modusign_request_failed' ||
    code === 'provider_request_failed' ||
    code === 'signature_request_failed'
  );
}
