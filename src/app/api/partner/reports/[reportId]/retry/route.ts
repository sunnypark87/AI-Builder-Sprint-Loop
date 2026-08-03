import { NextResponse } from 'next/server';

import { reportError, safeReportError, UUID } from '@/lib/reports/http';
import { createReportRepository } from '@/lib/reports/report-repository';
import { retryDonationReport } from '@/lib/reports/report-service';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;
    if (!UUID.test(reportId)) {
      return reportError(
        400,
        'invalid_identifier',
        '보고서 식별자가 올바르지 않습니다.',
        false,
      );
    }
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const result = await retryDonationReport(reportId, {
      repository: createReportRepository(supabase, {
        actorUserId: userId,
        client: createServiceClient(),
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return safeReportError(error);
  }
}
