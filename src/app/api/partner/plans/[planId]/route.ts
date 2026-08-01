import { NextResponse } from 'next/server';

import { createPlanRepository } from '@/lib/plans/plan-repository';
import { PlanServiceError, retryPlanAnalysis } from '@/lib/plans/plan-service';
import { parsePlanDraft, validatePlanDraft } from '@/lib/plans/plan-schema';
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
  if (error instanceof PlanServiceError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      },
      { status: error.httpStatus },
    );
  }
  if (error instanceof AuthenticationError) {
    return responseError(401, 'unauthenticated', error.message);
  }
  if (error instanceof SupabaseConfigurationError) {
    return responseError(
      503,
      'service_unavailable',
      '집행 계획 저장소가 구성되지 않았습니다.',
    );
  }
  return responseError(
    500,
    'internal_error',
    '집행 계획을 처리할 수 없습니다.',
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const result = await retryPlanAnalysis(planId, {
      repository: createPlanRepository(supabase, {
        actorUserId: userId,
        client: createServiceClient(),
      }),
    });

    return NextResponse.json({
      planId: result.planId,
      status: result.status,
    });
  } catch (error) {
    return safeError(error);
  }
}

async function authorizedRepository(mutations = false) {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  return createPlanRepository(
    supabase,
    mutations
      ? { actorUserId: userId, client: createServiceClient() }
      : undefined,
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const { planId } = await params;
    if (!UUID.test(planId)) {
      return responseError(
        400,
        'invalid_identifier',
        '집행 계획 식별자가 올바르지 않습니다.',
      );
    }

    const plan = await (await authorizedRepository()).getReview(planId);
    if (!plan) {
      return responseError(404, 'not_found', '집행 계획을 찾을 수 없습니다.');
    }

    return NextResponse.json(plan, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  try {
    const { planId } = await params;
    if (!UUID.test(planId)) {
      return responseError(
        400,
        'invalid_identifier',
        '집행 계획 식별자가 올바르지 않습니다.',
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

    const draft =
      typeof payload === 'object' && payload !== null
        ? parsePlanDraft((payload as Record<string, unknown>).draft)
        : null;
    if (!draft) {
      return responseError(
        400,
        'invalid_draft',
        '집행 계획 입력값을 확인해 주세요.',
      );
    }

    const issues = validatePlanDraft(draft);
    if (issues.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: '수정이 필요한 집행 계획 항목이 있습니다.',
            retryable: false,
          },
          issues,
        },
        { status: 422 },
      );
    }

    const repository = await authorizedRepository(true);
    const plan = await repository.getReview(planId);
    if (!plan) {
      return responseError(404, 'not_found', '집행 계획을 찾을 수 없습니다.');
    }
    if (plan.status === 'registered') {
      return NextResponse.json({ planId, status: 'registered' });
    }
    if (plan.status !== 'review_required') {
      return responseError(
        409,
        'invalid_status',
        '현재 상태에서는 집행 계획을 등록할 수 없습니다.',
      );
    }

    await repository.register(planId, draft);
    return NextResponse.json({ planId, status: 'registered' });
  } catch (error) {
    return safeError(error);
  }
}
