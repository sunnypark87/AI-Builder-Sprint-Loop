import { NextResponse } from 'next/server';

import { createPlanRepository } from '@/lib/plans/plan-repository';
import { analyzePlan, PlanServiceError } from '@/lib/plans/plan-service';
import { AuthenticationError, requireUserId } from '@/lib/supabase/auth';
import {
  createClient,
  SupabaseConfigurationError,
} from '@/lib/supabase/server';

function stringField(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
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
    const form = await request.formData();
    const file = form.get('document');

    if (!(file instanceof File)) {
      throw new PlanServiceError(
        'invalid_file',
        '집행 계획서 파일을 선택해 주세요.',
        400,
      );
    }

    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const result = await analyzePlan(
      {
        userId,
        organizationId: stringField(form, 'organizationId'),
        donationId: stringField(form, 'donationId'),
        idempotencyKey: stringField(form, 'idempotencyKey'),
        file,
      },
      {
        repository: createPlanRepository(supabase),
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
