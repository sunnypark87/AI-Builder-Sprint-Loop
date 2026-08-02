import { NextResponse } from 'next/server';

import {
  createPlanRepository,
  PlanIdempotencyConflictError,
} from '@/lib/plans/plan-repository';
import { parsePlanDraft, validatePlanDraft } from '@/lib/plans/plan-schema';
import { analyzePlan, PlanServiceError } from '@/lib/plans/plan-service';
import { AuthenticationError, requireUserId } from '@/lib/supabase/auth';
import {
  createClient,
  createServiceClient,
  SupabaseConfigurationError,
} from '@/lib/supabase/server';

function stringField(payload: unknown, name: string) {
  const value =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)[name]
      : undefined;
  return typeof value === 'string' ? value : '';
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9:_-]{16,128}$/;

function valueField(payload: unknown, name: string) {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)[name]
    : undefined;
}

function safeError(error: unknown) {
  if (error instanceof PlanServiceError) {
    return NextResponse.json(
      {
        planId: error.planId,
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
    return NextResponse.json(
      {
        error: {
          code: 'unauthenticated',
          message: error.message,
          retryable: false,
        },
      },
      { status: 401 },
    );
  }

  if (error instanceof PlanIdempotencyConflictError) {
    return NextResponse.json(
      {
        error: {
          code: 'idempotency_conflict',
          message: error.message,
          retryable: false,
        },
      },
      { status: 409 },
    );
  }

  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json(
      {
        error: {
          code: 'service_unavailable',
          message: '집행 계획 저장소가 구성되지 않았습니다.',
          retryable: false,
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: 'internal_error',
        message: '집행 계획을 처리할 수 없습니다.',
        retryable: true,
      },
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new PlanServiceError(
        'invalid_file',
        '업로드된 집행 계획서 정보를 확인해 주세요.',
        400,
      );
    }

    const organizationId = stringField(payload, 'organizationId');
    const donationId = stringField(payload, 'donationId');
    const idempotencyKey = stringField(payload, 'idempotencyKey');
    const mode = stringField(payload, 'mode');

    if (mode === 'manual') {
      const parsedDraft = parsePlanDraft(valueField(payload, 'draft'));
      if (
        !UUID.test(organizationId) ||
        !UUID.test(donationId) ||
        !IDEMPOTENCY_KEY.test(idempotencyKey) ||
        !parsedDraft
      ) {
        return NextResponse.json(
          {
            error: {
              code: 'invalid_plan',
              message: '직접 입력한 집행 계획 정보를 확인해 주세요.',
              retryable: false,
            },
          },
          { status: 400 },
        );
      }

      const draft = {
        ...parsedDraft,
        title: parsedDraft.title.trim(),
        items: parsedDraft.items.map((item) => ({
          ...item,
          id: item.id.trim(),
          name: item.name.trim(),
          description: item.description.trim(),
          confidence: null,
          sourceText: '',
          sourceName: '',
          sourceAmount: null,
        })),
      };
      const issues = validatePlanDraft(draft);
      if (issues.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: 'validation_failed',
              message: '입력한 계획 내용을 확인해 주세요.',
              retryable: false,
            },
            issues,
          },
          { status: 422 },
        );
      }

      const supabase = await createClient();
      const userId = await requireUserId(supabase);
      const repository = createPlanRepository(supabase, {
        actorUserId: userId,
        client: createServiceClient(),
      });
      const result = await repository.createManualPlan({
        userId,
        organizationId,
        donationId,
        idempotencyKey,
        draft,
      });
      return NextResponse.json(
        {
          planId: result.id,
          status: 'registered',
          duplicate: !result.created,
          draft,
          issues: [],
          metadata: null,
        },
        { status: result.created ? 201 : 200 },
      );
    }

    const sourcePath = stringField(payload, 'sourcePath');
    const fileName = stringField(payload, 'fileName');
    const mimeType = stringField(payload, 'mimeType');
    if (
      !organizationId ||
      !donationId ||
      !idempotencyKey ||
      !sourcePath ||
      !fileName ||
      !mimeType
    ) {
      throw new PlanServiceError(
        'invalid_file',
        '업로드된 집행 계획서 정보를 확인해 주세요.',
        400,
      );
    }

    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const repository = createPlanRepository(supabase, {
      actorUserId: userId,
      client: createServiceClient(),
    });
    const result = await analyzePlan(
      {
        userId,
        organizationId,
        donationId,
        idempotencyKey,
        sourcePath,
        fileName,
        mimeType,
      },
      {
        repository,
      },
    );

    return NextResponse.json(
      {
        planId: result.planId,
        status: result.status,
        duplicate: result.duplicate,
        draft: result.parsed?.draft ?? null,
        issues: result.parsed?.issues ?? [],
        metadata: result.parsed?.metadata ?? null,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return safeError(error);
  }
}
