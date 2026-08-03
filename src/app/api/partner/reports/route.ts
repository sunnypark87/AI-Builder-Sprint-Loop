import { NextResponse } from 'next/server';

import { reportError, safeReportError, UUID } from '@/lib/reports/http';
import { createReportRepository } from '@/lib/reports/report-repository';
import { createDonationReport } from '@/lib/reports/report-service';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function repository() {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  return createReportRepository(supabase, {
    actorUserId: userId,
    client: createServiceClient(),
  });
}

export async function GET() {
  try {
    return NextResponse.json(
      { donations: await (await repository()).listEligible() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return safeReportError(error);
  }
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return reportError(
        400,
        'invalid_json',
        '요청 형식을 확인해 주세요.',
        false,
      );
    }
    const record =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const donationId =
      typeof record.donationId === 'string' ? record.donationId : '';
    const planId = typeof record.planId === 'string' ? record.planId : '';
    const idempotencyKey =
      typeof record.idempotencyKey === 'string'
        ? record.idempotencyKey.trim()
        : '';
    if (
      !UUID.test(donationId) ||
      !UUID.test(planId) ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 200
    ) {
      return reportError(
        400,
        'invalid_request',
        '보고 대상과 요청 식별자를 확인해 주세요.',
        false,
      );
    }
    const result = await createDonationReport(
      { donationId, planId, idempotencyKey },
      { repository: await repository() },
    );
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return safeReportError(error);
  }
}
