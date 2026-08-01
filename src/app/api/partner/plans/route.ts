import { NextResponse } from 'next/server';

import { createPlanRepository } from '@/lib/plans/plan-repository';
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
