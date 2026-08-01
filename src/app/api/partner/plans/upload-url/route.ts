import { NextResponse } from 'next/server';

import {
  ACCEPTED_PLAN_DOCUMENT_TYPES,
  PLAN_DOCUMENT_LIMITS,
  type PlanDocumentType,
} from '@/lib/plans/file-validation';
import {
  createPlanRepository,
  PLAN_DOCUMENT_BUCKET,
} from '@/lib/plans/plan-repository';
import { AuthenticationError, requireUserId } from '@/lib/supabase/auth';
import {
  createClient,
  createServiceClient,
  SupabaseConfigurationError,
} from '@/lib/supabase/server';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringField(payload: unknown, name: string) {
  const value =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)[name]
      : undefined;
  return typeof value === 'string' ? value : '';
}

function numberField(payload: unknown, name: string) {
  const value =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)[name]
      : undefined;
  return typeof value === 'number' ? value : Number.NaN;
}

function extensionFor(type: PlanDocumentType) {
  if (type === 'application/pdf') return 'pdf';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message, retryable: status >= 500 } },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return errorResponse(
        400,
        'invalid_request',
        '파일 정보를 확인해 주세요.',
      );
    }

    const organizationId = stringField(payload, 'organizationId');
    const donationId = stringField(payload, 'donationId');
    const fileName = stringField(payload, 'fileName')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 200);
    const mimeType = stringField(payload, 'mimeType') as PlanDocumentType;
    const size = numberField(payload, 'size');
    if (
      !UUID.test(organizationId) ||
      !UUID.test(donationId) ||
      !fileName.trim() ||
      !ACCEPTED_PLAN_DOCUMENT_TYPES.includes(mimeType) ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > PLAN_DOCUMENT_LIMITS.maxBytes
    ) {
      return errorResponse(
        400,
        'invalid_file',
        'PDF, JPG, PNG 형식의 10MB 이하 파일만 업로드할 수 있습니다.',
      );
    }

    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const repository = createPlanRepository(supabase);
    if (!(await repository.assertDonationAccess(organizationId, donationId))) {
      return errorResponse(
        403,
        'forbidden',
        '선택한 기부 내역에 집행 계획을 등록할 권한이 없습니다.',
      );
    }

    const sourcePath = `${organizationId}/pending/${userId}/${crypto.randomUUID()}/source.${extensionFor(mimeType)}`;
    const service = createServiceClient();
    const { data, error } = await service.storage
      .from(PLAN_DOCUMENT_BUCKET)
      .createSignedUploadUrl(sourcePath);
    if (error || !data) {
      return errorResponse(
        503,
        'upload_unavailable',
        '파일 업로드를 준비할 수 없습니다.',
      );
    }

    return NextResponse.json({ sourcePath, token: data.token });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return errorResponse(401, 'unauthenticated', error.message);
    }
    if (error instanceof SupabaseConfigurationError) {
      return errorResponse(
        503,
        'service_unavailable',
        '집행 계획 저장소가 구성되지 않았습니다.',
      );
    }
    return errorResponse(
      500,
      'internal_error',
      '파일 업로드를 준비할 수 없습니다.',
    );
  }
}
