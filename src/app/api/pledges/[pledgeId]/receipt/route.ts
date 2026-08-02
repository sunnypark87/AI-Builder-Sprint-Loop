import { NextResponse } from 'next/server';

import { buildDemoReceipt } from '@/lib/receipts/demo';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pledgeId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const { pledgeId } = await context.params;
  const supabase = await createClient();
  const { data: receipt, error } = await supabase
    .from('demo_receipts')
    .select('id, pledge_id, receipt_number, issued_at')
    .eq('pledge_id', pledgeId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { code: 'receipt_lookup_failed' },
      { status: 503 },
    );
  }

  if (!receipt) {
    return NextResponse.json({ code: 'receipt_not_found' }, { status: 404 });
  }

  return NextResponse.json({ receipt });
}

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const { pledgeId } = await context.params;
  const userClient = await createClient();
  const { data: pledge, error: pledgeError } = await userClient
    .from('pledges')
    .select(
      'id, status, donor_name, donor_address, amount, pledge_date, receipt_requested',
    )
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();

  if (pledgeError) {
    return NextResponse.json({ code: 'pledge_lookup_failed' }, { status: 503 });
  }

  if (!pledge) {
    return NextResponse.json({ code: 'pledge_not_found' }, { status: 404 });
  }

  if (pledge.status !== 'signed') {
    return NextResponse.json({ code: 'pledge_not_signed' }, { status: 409 });
  }

  if (
    !pledge.receipt_requested ||
    !pledge.donor_name ||
    !pledge.donor_address
  ) {
    return NextResponse.json(
      { code: 'receipt_details_missing' },
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

  const { data: existingReceipt, error: existingError } = await adminClient
    .from('demo_receipts')
    .select('id, pledge_id, receipt_number, issued_at')
    .eq('pledge_id', pledgeId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { code: 'receipt_lookup_failed' },
      { status: 503 },
    );
  }

  if (existingReceipt) {
    return NextResponse.json({ receipt: existingReceipt });
  }

  const receipt = buildDemoReceipt({
    amount: Number(pledge.amount),
    donorName: pledge.donor_name,
    pledgeDate: pledge.pledge_date,
    pledgeId,
    recipientAddress: pledge.donor_address,
    recipientName: pledge.donor_name,
  });
  const { data: insertedReceipt, error: insertError } = await adminClient
    .from('demo_receipts')
    .insert({
      pledge_id: pledgeId,
      receipt_number: receipt.receiptNumber,
      issued_at: receipt.issuedAt,
    })
    .select('id, pledge_id, receipt_number, issued_at')
    .single();

  if (insertError || !insertedReceipt) {
    return NextResponse.json(
      { code: 'receipt_create_failed' },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { receipt: { ...receipt, id: insertedReceipt.id } },
    { status: 201 },
  );
}
