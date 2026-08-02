import { NextResponse } from 'next/server';

import { createExecutionRepository } from '@/lib/executions/execution-repository';
import {
  ExecutionServiceError,
  retryExecutionAnalysis,
} from '@/lib/executions/execution-service';
import { receiptSemanticKey } from '@/lib/executions/parse-ocr-receipt';
import {
  parseReceiptDraft,
  validateReceiptDraft,
} from '@/lib/executions/receipt-schema';
import {
  hasBlockedVerification,
  hasVerificationWarning,
  verifyReceipt,
} from '@/lib/executions/receipt-verification';
import { AuthenticationError, requireUserId } from '@/lib/supabase/auth';
import {
  createClient,
  createServiceClient,
  SupabaseConfigurationError,
} from '@/lib/supabase/server';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function responseError(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message, retryable: status >= 500 } },
    { status },
  );
}

function safeError(error: unknown) {
  if (error instanceof ExecutionServiceError) {
    return responseError(error.httpStatus, error.code, error.message);
  }
  if (error instanceof AuthenticationError) {
    return responseError(401, 'unauthenticated', error.message);
  }
  if (error instanceof SupabaseConfigurationError) {
    return responseError(
      503,
      'service_unavailable',
      '집행 내역 저장소가 구성되지 않았습니다.',
    );
  }
  const message = error instanceof Error ? error.message : '';
  if (message.includes('중복') || message.includes('duplicate')) {
    return responseError(
      409,
      'duplicate_receipt',
      '동일한 영수증이 이미 등록됐습니다.',
    );
  }
  if (message.includes('Remaining budget exceeded')) {
    return responseError(
      409,
      'budget_exceeded',
      '최신 예산 잔액을 초과해 등록할 수 없습니다.',
    );
  }
  return responseError(
    500,
    'internal_error',
    '집행 내역을 처리할 수 없습니다.',
  );
}

async function repository(mutations = false) {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  return createExecutionRepository(
    supabase,
    mutations
      ? { actorUserId: userId, client: createServiceClient() }
      : undefined,
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    const { executionId } = await params;
    if (!UUID.test(executionId)) {
      return responseError(
        400,
        'invalid_identifier',
        '집행 내역 식별자가 올바르지 않습니다.',
      );
    }
    const review = await (await repository()).getReview(executionId);
    if (!review) {
      return responseError(404, 'not_found', '집행 내역을 찾을 수 없습니다.');
    }
    return NextResponse.json(review, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    const { executionId } = await params;
    if (!UUID.test(executionId)) {
      return responseError(
        400,
        'invalid_identifier',
        '집행 내역 식별자가 올바르지 않습니다.',
      );
    }
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return responseError(
        400,
        'invalid_json',
        '등록 요청 형식을 확인해 주세요.',
      );
    }
    const record =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const draft = parseReceiptDraft(record.draft);
    const warningReason =
      typeof record.warningReason === 'string'
        ? record.warningReason.trim()
        : '';
    if (!draft || warningReason.length > 1000) {
      return responseError(
        400,
        'invalid_draft',
        '영수증 입력값을 확인해 주세요.',
      );
    }
    const issues = validateReceiptDraft(draft);
    if (issues.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: '수정이 필요한 영수증 항목이 있습니다.',
            retryable: false,
          },
          issues,
        },
        { status: 422 },
      );
    }

    const target = await repository(true);
    const review = await target.getReview(executionId);
    if (!review) {
      return responseError(404, 'not_found', '집행 내역을 찾을 수 없습니다.');
    }
    if (review.status === 'registered') {
      if (JSON.stringify(review.draft) === JSON.stringify(draft)) {
        return NextResponse.json({ executionId, status: 'registered' });
      }
      return responseError(
        409,
        'already_registered',
        '이미 등록된 집행 내역은 수정할 수 없습니다.',
      );
    }
    if (!['review_required', 'verification_warning'].includes(review.status)) {
      return responseError(
        409,
        'invalid_status',
        '현재 상태에서는 집행 내역을 등록할 수 없습니다.',
      );
    }
    const eligibility = await target.getEligibility(
      review.organizationId,
      review.donationId,
      review.planId,
      review.planItemId,
    );
    if (!eligibility) {
      return responseError(
        409,
        'invalid_reference',
        '연결된 계획 항목을 확인할 수 없습니다.',
      );
    }
    const context = await target.verificationContext(
      eligibility,
      review.sourceFingerprint,
      receiptSemanticKey(draft),
      executionId,
    );
    const verificationResults = verifyReceipt(draft, issues, context);
    if (hasBlockedVerification(verificationResults)) {
      return NextResponse.json(
        {
          error: {
            code: 'verification_blocked',
            message: '차단된 검증 항목을 해결해야 등록할 수 있습니다.',
            retryable: false,
          },
          verificationResults,
        },
        { status: 422 },
      );
    }
    if (hasVerificationWarning(verificationResults) && !warningReason) {
      return NextResponse.json(
        {
          error: {
            code: 'warning_reason_required',
            message: '검증 경고를 확인한 사유를 입력해 주세요.',
            retryable: false,
          },
          verificationResults,
        },
        { status: 422 },
      );
    }
    await target.register(
      executionId,
      draft,
      verificationResults,
      warningReason,
    );
    return NextResponse.json({ executionId, status: 'registered' });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ executionId: string }> },
) {
  try {
    const { executionId } = await params;
    const target = await repository(true);
    const result = await retryExecutionAnalysis(executionId, {
      repository: target,
    });
    return NextResponse.json({
      executionId: result.executionId,
      status: result.status,
    });
  } catch (error) {
    return safeError(error);
  }
}
