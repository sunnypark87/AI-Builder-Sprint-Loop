import { NextResponse } from 'next/server';

import {
  ACCEPTED_RECEIPT_DOCUMENT_TYPES,
  RECEIPT_DOCUMENT_LIMITS,
  type ReceiptDocumentType,
} from '@/lib/executions/receipt-file-validation';
import {
  createExecutionRepository,
  RECEIPT_DOCUMENT_BUCKET,
} from '@/lib/executions/execution-repository';
import { AuthenticationError, requireUserId } from '@/lib/supabase/auth';
import {
  createClient,
  createServiceClient,
  SupabaseConfigurationError,
} from '@/lib/supabase/server';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9:_-]{16,128}$/;

function field(payload: unknown, name: string) {
  const value =
    typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)[name]
      : undefined;
  return typeof value === 'string' ? value : '';
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message, retryable: status >= 500 } },
    { status },
  );
}

function extensionFor(type: ReceiptDocumentType) {
  if (type === 'application/pdf') return 'pdf';
  if (type === 'image/png') return 'png';
  return 'jpg';
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
    const organizationId = field(payload, 'organizationId');
    const donationId = field(payload, 'donationId');
    const planId = field(payload, 'planId');
    const planItemId = field(payload, 'planItemId');
    const fileName = field(payload, 'fileName')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 200);
    const mimeType = field(payload, 'mimeType') as ReceiptDocumentType;
    const rawSize =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>).size
        : undefined;
    const size = typeof rawSize === 'number' ? rawSize : Number.NaN;
    if (
      ![organizationId, donationId, planId, planItemId].every((id) =>
        UUID.test(id),
      ) ||
      !fileName.trim() ||
      !ACCEPTED_RECEIPT_DOCUMENT_TYPES.includes(mimeType) ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > RECEIPT_DOCUMENT_LIMITS.maxBytes
    ) {
      return errorResponse(
        400,
        'invalid_file',
        'PDF, JPG, PNG 형식의 10MB 이하 영수증만 업로드할 수 있습니다.',
      );
    }

    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const eligible = await createExecutionRepository(supabase).getEligibility(
      organizationId,
      donationId,
      planId,
      planItemId,
    );
    if (!eligible) {
      return errorResponse(
        403,
        'forbidden',
        '선택한 계획 항목에 집행 내역을 등록할 권한이 없습니다.',
      );
    }

    const sourcePath = `${organizationId}/pending/${userId}/${crypto.randomUUID()}/source.${extensionFor(mimeType)}`;
    const { data, error } = await createServiceClient()
      .storage.from(RECEIPT_DOCUMENT_BUCKET)
      .createSignedUploadUrl(sourcePath);
    if (error || !data) {
      return errorResponse(
        503,
        'upload_unavailable',
        '영수증 업로드를 준비할 수 없습니다.',
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
        '집행 내역 저장소가 구성되지 않았습니다.',
      );
    }
    return errorResponse(
      500,
      'internal_error',
      '영수증 업로드를 준비할 수 없습니다.',
    );
  }
}

export async function DELETE(request: Request) {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return errorResponse(
        400,
        'invalid_request',
        '업로드 경로를 확인해 주세요.',
      );
    }
    const supabase = await createClient();
    const userId = await requireUserId(supabase);
    const sourcePath = field(payload, 'sourcePath');
    const idempotencyKey = field(payload, 'idempotencyKey');
    const segments = sourcePath.split('/');
    if (
      segments.length !== 5 ||
      !UUID.test(segments[0]) ||
      segments[1] !== 'pending' ||
      segments[2] !== userId ||
      !UUID.test(segments[3]) ||
      !['source.pdf', 'source.png', 'source.jpg'].includes(segments[4]) ||
      !IDEMPOTENCY_KEY.test(idempotencyKey)
    ) {
      return errorResponse(
        400,
        'invalid_request',
        '업로드 경로를 확인해 주세요.',
      );
    }
    const { data: execution, error: executionError } = await supabase
      .from('expenditure_executions')
      .select('id')
      .eq('created_by', userId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (executionError) throw executionError;
    if (execution) return new NextResponse(null, { status: 204 });
    await createExecutionRepository(supabase, {
      actorUserId: userId,
      client: createServiceClient(),
    }).removeSource(sourcePath);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return errorResponse(401, 'unauthenticated', error.message);
    }
    if (error instanceof SupabaseConfigurationError) {
      return errorResponse(
        503,
        'service_unavailable',
        '집행 내역 저장소가 구성되지 않았습니다.',
      );
    }
    return errorResponse(500, 'internal_error', '업로드를 정리할 수 없습니다.');
  }
}
