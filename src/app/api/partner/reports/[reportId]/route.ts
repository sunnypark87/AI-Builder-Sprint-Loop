import { NextResponse } from 'next/server';

import { reportError, safeReportError, UUID } from '@/lib/reports/http';
import { createReportRepository } from '@/lib/reports/report-repository';
import {
  parseAndValidateReportContent,
  parseReportContent,
} from '@/lib/reports/report-schema';
import { requireUserId } from '@/lib/supabase/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ reportId: string }> };

async function repository(mutations = false) {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  return createReportRepository(
    supabase,
    mutations
      ? { actorUserId: userId, client: createServiceClient() }
      : undefined,
  );
}

export async function GET(_request: Request, { params }: Context) {
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
    const review = await (await repository()).getReview(reportId);
    if (!review) {
      return reportError(404, 'not_found', '보고서를 찾을 수 없습니다.', false);
    }
    return NextResponse.json(review, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return safeReportError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
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
    const record =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const content = parseReportContent(record.content);
    if (!content) {
      return reportError(
        400,
        'invalid_content',
        '보고서 입력값을 확인해 주세요.',
        false,
      );
    }
    const target = await repository(true);
    const review = await target.getReview(reportId);
    if (!review) {
      return reportError(404, 'not_found', '보고서를 찾을 수 없습니다.', false);
    }
    if (review.status !== 'review_required') {
      return reportError(
        409,
        'invalid_status',
        '현재 상태에서는 보고서를 수정할 수 없습니다.',
        false,
      );
    }
    const validation = parseAndValidateReportContent(content, review.evidence);
    await target.saveDraft(reportId, content, validation.issues);
    if (validation.issues.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: '수정이 필요한 보고서 항목이 있습니다.',
            retryable: false,
          },
          issues: validation.issues,
        },
        { status: 422 },
      );
    }
    return NextResponse.json({ reportId, status: 'review_required' });
  } catch (error) {
    return safeReportError(error);
  }
}
