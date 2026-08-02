import { NextResponse } from 'next/server';

import { createExecutionRepository } from '@/lib/executions/execution-repository';
import {
  analyzeExecution,
  ExecutionServiceError,
} from '@/lib/executions/execution-service';
import { AuthenticationError, requireUserId } from '@/lib/supabase/auth';
import {
  createClient,
  createServiceClient,
  SupabaseConfigurationError,
} from '@/lib/supabase/server';

function field(payload: unknown, name: string) {
  const value =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)[name]
      : undefined;
  return typeof value === 'string' ? value : '';
}

function safeError(error: unknown) {
  if (error instanceof ExecutionServiceError) {
    return NextResponse.json(
      {
        executionId: error.executionId,
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
          message: '집행 내역 저장소가 구성되지 않았습니다.',
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
        message: '집행 내역을 처리할 수 없습니다.',
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
      throw new ExecutionServiceError(
        'invalid_file',
        '업로드된 영수증 정보를 확인해 주세요.',
        400,
      );
    }
    const required = [
      'organizationId',
      'donationId',
      'planId',
      'planItemId',
      'idempotencyKey',
      'sourcePath',
      'fileName',
      'mimeType',
    ] as const;
    if (required.some((name) => !field(payload, name))) {
      throw new ExecutionServiceError(
        'invalid_file',
        '업로드된 영수증 정보를 확인해 주세요.',
        400,
      );
    }
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const result = await analyzeExecution(
      {
        userId,
        organizationId: field(payload, 'organizationId'),
        donationId: field(payload, 'donationId'),
        planId: field(payload, 'planId'),
        planItemId: field(payload, 'planItemId'),
        idempotencyKey: field(payload, 'idempotencyKey'),
        sourcePath: field(payload, 'sourcePath'),
        fileName: field(payload, 'fileName'),
        mimeType: field(payload, 'mimeType'),
      },
      {
        repository: createExecutionRepository(supabase, {
          actorUserId: userId,
          client: createServiceClient(),
        }),
      },
    );
    return NextResponse.json(
      {
        executionId: result.executionId,
        status: result.status,
        duplicate: result.duplicate,
        draft: result.parsed?.draft ?? null,
        issues: result.parsed?.issues ?? [],
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return safeError(error);
  }
}
