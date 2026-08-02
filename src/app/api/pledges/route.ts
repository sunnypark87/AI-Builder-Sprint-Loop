import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { validateDraftPledgeInput } from '@/lib/pledges/input';
import type { PledgeChatMessage } from '@/lib/pledges/chat';
import {
  encryptIdentityNumber,
  identityNumberLast4,
  isIdentityNumberCollectionEnabled,
  normalizeIdentityNumber,
} from '@/lib/pledges/identity-number';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { code: 'unauthorized', message: '로그인이 필요합니다.' },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'invalid_json', message: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  const validation = validateDraftPledgeInput(body);

  if (!validation.ok) {
    return NextResponse.json(
      { code: 'invalid_input', errors: validation.errors },
      { status: 400 },
    );
  }

  const conversationMessages = getConversationMessages(body);
  if (!conversationMessages.ok) {
    return NextResponse.json(
      { code: 'invalid_conversation_messages' },
      { status: 400 },
    );
  }

  let identityStorage: Record<string, string> = {};
  if (validation.value.identityNumber) {
    if (!isIdentityNumberCollectionEnabled()) {
      return NextResponse.json(
        { code: 'identity_number_collection_disabled' },
        { status: 503 },
      );
    }

    const identityNumber = normalizeIdentityNumber(
      validation.value.identityNumber,
    );
    let encrypted;
    try {
      encrypted = encryptIdentityNumber(identityNumber);
    } catch {
      return NextResponse.json(
        { code: 'identity_number_configuration_missing' },
        { status: 503 },
      );
    }
    identityStorage = {
      donor_identity_number_auth_tag: encrypted.authTag,
      donor_identity_number_ciphertext: encrypted.ciphertext,
      donor_identity_number_collected_at: new Date().toISOString(),
      donor_identity_number_iv: encrypted.iv,
      donor_identity_number_last4: identityNumberLast4(identityNumber),
    };
  }

  const supabase = await createClient();
  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', validation.value.organizationSlug)
    .eq('is_public', true)
    .maybeSingle();

  if (organizationError) {
    return NextResponse.json(
      { code: 'organization_lookup_failed' },
      { status: 503 },
    );
  }

  if (!organization) {
    return NextResponse.json(
      { code: 'organization_not_found' },
      { status: 404 },
    );
  }

  const { data: pledge, error: pledgeError } = await supabase
    .from('pledges')
    .insert({
      ...identityStorage,
      allocation_end_date: validation.value.allocationEndDate ?? null,
      allocation_months: validation.value.allocationMonths ?? null,
      allocation_start_date: validation.value.allocationStartDate ?? null,
      anonymous_requested: validation.value.anonymousRequested ?? false,
      donor_address: validation.value.address ?? null,
      amount: validation.value.amount ?? null,
      donor_contact: validation.value.contact ?? null,
      contact_person: validation.value.contactPerson ?? null,
      department: validation.value.department ?? null,
      donor_email: validation.value.donorEmail ?? null,
      donor_name: validation.value.donorName ?? null,
      donation_condition: validation.value.donationCondition ?? null,
      donation_designation: validation.value.donationDesignation ?? null,
      donation_kind: validation.value.donationKind ?? null,
      donation_kind_other: validation.value.donationKindOther ?? null,
      donation_type: validation.value.donationType ?? null,
      identity_info_consent: validation.value.identityInfoConsent ?? null,
      organization_id: organization.id,
      payment_method: validation.value.paymentMethod ?? null,
      payment_method_other: validation.value.paymentMethodOther ?? null,
      payment_schedule: validation.value.paymentSchedule ?? null,
      payment_schedule_other: validation.value.paymentScheduleOther ?? null,
      personal_info_consent: validation.value.personalInfoConsent ?? null,
      pledge_date: validation.value.pledgeDate ?? null,
      purpose: validation.value.purpose ?? null,
      receipt_recipient_address:
        validation.value.receiptRecipientAddress ?? null,
      receipt_recipient_name: validation.value.receiptRecipientName ?? null,
      receipt_requested: validation.value.receiptRequested,
      status: 'draft',
      third_party_info_consent: validation.value.thirdPartyInfoConsent ?? null,
      donor_user_id: user.id,
    })
    .select('id')
    .single();

  if (pledgeError || !pledge) {
    return NextResponse.json({ code: 'pledge_create_failed' }, { status: 503 });
  }

  if (conversationMessages.value.length) {
    const { error: conversationError } = await supabase
      .from('pledge_chat_messages')
      .insert(
        conversationMessages.value.map((message) => ({
          content: message.content,
          pledge_id: pledge.id,
          proposed_patch: message.proposedPatch ?? null,
          role: message.role,
        })),
      );
    if (conversationError) {
      return NextResponse.json(
        { code: 'pledge_conversation_save_failed', pledgeId: pledge.id },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    { pledgeId: pledge.id, status: 'draft' },
    { status: 201 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChatMessage(value: unknown): value is PledgeChatMessage {
  return (
    isRecord(value) &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    value.content.length > 0 &&
    value.content.length <= 4000
  );
}

function getConversationMessages(
  body: unknown,
): { ok: true; value: PledgeChatMessage[] } | { ok: false } {
  if (!isRecord(body) || body.conversationMessages === undefined) {
    return { ok: true, value: [] };
  }
  if (
    !Array.isArray(body.conversationMessages) ||
    !body.conversationMessages.every(isChatMessage)
  ) {
    return { ok: false };
  }
  return { ok: true, value: body.conversationMessages };
}
