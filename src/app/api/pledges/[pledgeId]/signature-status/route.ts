import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pledgeId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const role = new URL(request.url).searchParams.get('role');
  if (role !== 'donor' && role !== 'organization') {
    return NextResponse.json({ code: 'invalid_role' }, { status: 400 });
  }

  const { pledgeId } = await context.params;
  const supabase = await createClient();
  const { data: pledge, error: pledgeError } = await supabase
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
    const { data: membership, error: membershipError } = await supabase
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

  return NextResponse.json({ status: pledge.status });
}
