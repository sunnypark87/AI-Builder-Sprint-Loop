import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { validateDraftPledgeInput } from '@/lib/pledges/input';
import { isExpectedPledgeVersion } from '@/lib/pledges/version';
import {
  encryptIdentityNumber,
  identityNumberLast4,
  isIdentityNumberCollectionEnabled,
  normalizeIdentityNumber,
} from '@/lib/pledges/identity-number';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pledgeId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const { pledgeId } = await context.params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pledges')
    .select(
      'id, status, amount, donation_type, donation_kind, donation_kind_other, donation_designation, purpose, pledge_date, donation_condition, donor_name, donor_address, donor_contact, donor_email, payment_schedule, payment_schedule_other, payment_method, payment_method_other, receipt_requested, receipt_recipient_name, receipt_recipient_address, personal_info_consent, third_party_info_consent, identity_info_consent, donor_identity_number_last4, donor_identity_number_collected_at, version, organizations(id, slug, name)',
    )
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ code: 'pledge_lookup_failed' }, { status: 503 });
  }

  if (!data) {
    return NextResponse.json({ code: 'pledge_not_found' }, { status: 404 });
  }

  return NextResponse.json({ pledge: data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const { pledgeId } = await context.params;
  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from('pledges')
    .select(
      'id, status, organization_id, donor_name, donor_address, receipt_requested, version',
    )
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ code: 'pledge_lookup_failed' }, { status: 503 });
  }

  if (!existing) {
    return NextResponse.json({ code: 'pledge_not_found' }, { status: 404 });
  }

  if (existing.status !== 'draft') {
    return NextResponse.json({ code: 'pledge_not_editable' }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'invalid_json' }, { status: 400 });
  }

  const validation = validateDraftPledgeInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { code: 'invalid_input', errors: validation.errors },
      { status: 400 },
    );
  }

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

  if (!organization || organization.id !== existing.organization_id) {
    return NextResponse.json(
      { code: 'organization_mismatch' },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const value = validation.value;
  if (!isExpectedPledgeVersion(raw.version, existing.version)) {
    return NextResponse.json({ code: 'pledge_changed' }, { status: 409 });
  }
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    version: existing.version + 1,
  };
  const fieldMap: Record<string, string> = {
    allocationEndDate: 'allocation_end_date',
    allocationMonths: 'allocation_months',
    allocationStartDate: 'allocation_start_date',
    address: 'donor_address',
    amount: 'amount',
    anonymousRequested: 'anonymous_requested',
    contact: 'donor_contact',
    contactPerson: 'contact_person',
    department: 'department',
    donorEmail: 'donor_email',
    donorName: 'donor_name',
    donationCondition: 'donation_condition',
    donationDesignation: 'donation_designation',
    donationKind: 'donation_kind',
    donationKindOther: 'donation_kind_other',
    donationType: 'donation_type',
    identityInfoConsent: 'identity_info_consent',
    pledgeDate: 'pledge_date',
    paymentMethod: 'payment_method',
    paymentMethodOther: 'payment_method_other',
    paymentSchedule: 'payment_schedule',
    paymentScheduleOther: 'payment_schedule_other',
    personalInfoConsent: 'personal_info_consent',
    purpose: 'purpose',
    receiptRequested: 'receipt_requested',
    thirdPartyInfoConsent: 'third_party_info_consent',
  };
  if ('identityNumber' in raw) {
    if (!isIdentityNumberCollectionEnabled()) {
      return NextResponse.json(
        { code: 'identity_number_collection_disabled' },
        { status: 503 },
      );
    }
    const identityNumber = value.identityNumber;
    if (!identityNumber) {
      return NextResponse.json(
        { code: 'identity_number_required' },
        { status: 400 },
      );
    }
    const normalized = normalizeIdentityNumber(identityNumber);
    let encrypted;
    try {
      encrypted = encryptIdentityNumber(normalized);
    } catch {
      return NextResponse.json(
        { code: 'identity_number_configuration_missing' },
        { status: 503 },
      );
    }
    updates.donor_identity_number_ciphertext = encrypted.ciphertext;
    updates.donor_identity_number_iv = encrypted.iv;
    updates.donor_identity_number_auth_tag = encrypted.authTag;
    updates.donor_identity_number_last4 = identityNumberLast4(normalized);
    updates.donor_identity_number_collected_at = new Date().toISOString();
  }
  for (const [inputField, column] of Object.entries(fieldMap)) {
    if (inputField in raw) {
      const nextValue =
        inputField === 'receiptRequested'
          ? value.receiptRequested
          : value[inputField as keyof typeof value];
      updates[column] = nextValue ?? null;
    }
  }
  const receiptRequested =
    'receiptRequested' in raw
      ? value.receiptRequested
      : Boolean(existing.receipt_requested);
  if (
    receiptRequested &&
    ('receiptRequested' in raw || 'donorName' in raw || 'address' in raw)
  ) {
    updates.receipt_recipient_name = value.donorName ?? existing.donor_name;
    updates.receipt_recipient_address = value.address ?? existing.donor_address;
  } else if ('receiptRequested' in raw && !receiptRequested) {
    updates.receipt_recipient_name = null;
    updates.receipt_recipient_address = null;
  }

  const { data, error } = await supabase
    .from('pledges')
    .update(updates)
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .eq('status', 'draft')
    .eq('version', existing.version)
    .select('*, organizations(id, slug, name)')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ code: 'pledge_update_failed' }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ code: 'pledge_changed' }, { status: 409 });
  }

  return NextResponse.json({ pledge: data });
}
