import { NextResponse } from 'next/server';

import { reportError, safeReportError, UUID } from '@/lib/reports/http';
import { createReportRepository } from '@/lib/reports/report-repository';
import {
  parseAndValidateReportContent,
  parseReportContent,
} from '@/lib/reports/report-schema';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
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
    const content = parseReportContent(
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>).content
        : null,
    );
    if (!content) {
      return reportError(
        400,
        'invalid_content',
        '보고서 입력값을 확인해 주세요.',
        false,
      );
    }
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const target = createReportRepository(supabase, {
      actorUserId: userId,
      client: createServiceClient(),
    });
    const review = await target.getReview(reportId);
    if (!review) {
      return reportError(404, 'not_found', '보고서를 찾을 수 없습니다.', false);
    }
    const validation = parseAndValidateReportContent(content, review.evidence);
    if (validation.issues.length > 0) {
      await target.saveDraft(reportId, content, validation.issues);
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: '검증 항목을 해결한 뒤 발행해 주세요.',
            retryable: false,
          },
          issues: validation.issues,
        },
        { status: 422 },
      );
    }
    await target.saveDraft(reportId, content, []);
    const eventKey = await target.publish(reportId, content);
    return NextResponse.json({ reportId, status: 'published', eventKey });
  } catch (error) {
    return safeReportError(error);
  }
}
