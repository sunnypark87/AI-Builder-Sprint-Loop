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
  | {
      pledge: {
        id: string;
        status: string;
        organization_id: string;
        amount: number | null;
      };
      user: { id: string };
    };

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
    if (
      existing.status === 'completed' &&
      !(await ensureDonation(admin, access.pledge))
    ) {
      return NextResponse.json(
        { code: 'donation_link_failed' },
        { status: 503 },
      );
    }
    return NextResponse.json({ payment: existing, idempotent: true });
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
    if (raced) return NextResponse.json({ payment: raced, idempotent: true });
    return NextResponse.json(
      { code: 'payment_create_failed' },
      { status: 503 },
    );
  }

  if (
    payment.status === 'completed' &&
    !(await ensureDonation(admin, access.pledge))
  ) {
    return NextResponse.json({ code: 'donation_link_failed' }, { status: 503 });
  }

  return NextResponse.json({ payment }, { status: 201 });
}

async function ensureDonation(
  admin: ReturnType<typeof createAdminClient>,
  pledge: {
    id: string;
    organization_id: string;
    amount: number | null;
  },
) {
  if (!pledge.amount || pledge.amount <= 0) return false;
  const { data: existing, error: lookupError } = await admin
    .from('donations')
    .select('id')
    .eq('pledge_id', pledge.id)
    .maybeSingle();
  if (lookupError) return false;
  if (existing) return true;
  const { error } = await admin.from('donations').insert({
    amount: pledge.amount,
    organization_id: pledge.organization_id,
    paid_at: new Date().toISOString(),
    paid_at_is_authoritative: true,
    pledge_id: pledge.id,
    status: 'paid',
  });
  if (!error) return true;
  const { data: raced } = await admin
    .from('donations')
    .select('id')
    .eq('pledge_id', pledge.id)
    .maybeSingle();
  return Boolean(raced);
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
    .select('id, status, donor_user_id, organization_id, amount')
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
