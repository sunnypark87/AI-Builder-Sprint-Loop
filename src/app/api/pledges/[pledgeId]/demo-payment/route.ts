import { NextResponse } from 'next/server';

import { paymentStatuses } from '@/lib/payments/status';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pledgeId: string }> };
const methods = ['card', 'transfer', 'easy'] as const;
type PaymentMethod = (typeof methods)[number];
type PledgeAccess =
  | { response: NextResponse }
  | { pledge: { id: string; status: string }; user: { id: string } };

export async function GET(_request: Request, context: RouteContext) {
  const access = await getPledgeAccess(context);
  if ('response' in access) return access.response;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { code: 'server_configuration_error' },
      { status: 503 },
    );
  }
  const { data, error } = await admin
    .from('demo_payments')
    .select(
      'id, pledge_id, method, status, idempotency_key, created_at, updated_at',
    )
    .eq('pledge_id', access.pledge.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { code: 'payment_lookup_failed' },
      { status: 503 },
    );
  }

  return NextResponse.json({ payment: data });
}

export async function POST(request: Request, context: RouteContext) {
  const access = await getPledgeAccess(context);
  if ('response' in access) return access.response;
  if (access.pledge.status !== 'signed') {
    return NextResponse.json(
      { code: 'payment_unavailable_before_signature' },
      { status: 409 },
    );
  }

  let body: { method?: string; status?: string };
  try {
    body = (await request.json()) as { method?: string; status?: string };
  } catch {
    return NextResponse.json({ code: 'invalid_json' }, { status: 400 });
  }

  if (!methods.includes(body.method as PaymentMethod)) {
    return NextResponse.json(
      { code: 'invalid_payment_method' },
      { status: 400 },
    );
  }
  if (
    !paymentStatuses.includes(body.status as (typeof paymentStatuses)[number])
  ) {
    return NextResponse.json(
      { code: 'invalid_payment_status' },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { code: 'server_configuration_error' },
      { status: 503 },
    );
  }
  const idempotencyKey = `pledge:${access.pledge.id}:demo-payment`;
  const { data: existing, error: existingError } = await admin
    .from('demo_payments')
    .select(
      'id, pledge_id, method, status, idempotency_key, created_at, updated_at',
    )
    .eq('pledge_id', access.pledge.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { code: 'payment_lookup_failed' },
      { status: 503 },
    );
  }
  if (existing) {
    const donation = await ensurePaidDonation(admin, access.user.id, existing);
    if (donation instanceof NextResponse) return donation;
    return NextResponse.json({
      ...(donation ? { donation } : {}),
      idempotent: true,
      payment: existing,
    });
  }

  const { data: payment, error } = await admin
    .from('demo_payments')
    .insert({
      donor_user_id: access.user.id,
      idempotency_key: idempotencyKey,
      method: body.method,
      pledge_id: access.pledge.id,
      status: body.status,
    })
    .select(
      'id, pledge_id, method, status, idempotency_key, created_at, updated_at',
    )
    .maybeSingle();

  if (error || !payment) {
    const { data: raced } = await admin
      .from('demo_payments')
      .select(
        'id, pledge_id, method, status, idempotency_key, created_at, updated_at',
      )
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (raced) {
      const donation = await ensurePaidDonation(admin, access.user.id, raced);
      if (donation instanceof NextResponse) return donation;
      return NextResponse.json({
        ...(donation ? { donation } : {}),
        idempotent: true,
        payment: raced,
      });
    }
    return NextResponse.json(
      { code: 'payment_create_failed' },
      { status: 503 },
    );
  }

  const donation = await ensurePaidDonation(admin, access.user.id, payment);
  if (donation instanceof NextResponse) return donation;

  return NextResponse.json(
    { ...(donation ? { donation } : {}), payment },
    { status: 201 },
  );
}

async function ensurePaidDonation(
  admin: ReturnType<typeof createAdminClient>,
  actorUserId: string,
  payment: { id: string; pledge_id: string; status: string },
) {
  if (payment.status !== 'completed') return null;

  const { data, error } = await admin
    .rpc('create_paid_donation_for_demo_payment', {
      p_actor_id: actorUserId,
      p_payment_id: payment.id,
      p_pledge_id: payment.pledge_id,
    })
    .maybeSingle();
  const row = data as { created?: unknown; donation_id?: unknown } | null;

  if (error || typeof row?.donation_id !== 'string') {
    return NextResponse.json(
      { code: 'donation_bridge_failed' },
      { status: 503 },
    );
  }

  return { id: row.donation_id, created: row.created === true };
}

async function getPledgeAccess(context: RouteContext): Promise<PledgeAccess> {
  const user = await getCurrentUser();
  if (!user)
    return {
      response: NextResponse.json({ code: 'unauthorized' }, { status: 401 }),
    };

  const { pledgeId } = await context.params;
  const supabase = await createClient();
  const { data: pledge, error } = await supabase
    .from('pledges')
    .select('id, status, donor_user_id')
    .eq('id', pledgeId)
    .eq('donor_user_id', user.id)
    .maybeSingle();
  if (error)
    return {
      response: NextResponse.json(
        { code: 'pledge_lookup_failed' },
        { status: 503 },
      ),
    };
  if (!pledge)
    return {
      response: NextResponse.json(
        { code: 'pledge_not_found' },
        { status: 404 },
      ),
    };
  return { pledge, user };
}
