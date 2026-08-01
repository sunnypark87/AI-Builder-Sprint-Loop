import {
  PlanDocumentValidationError,
  validatePlanDocument,
} from '@/lib/plans/file-validation';
import type {
  ExistingAnalysis,
  PlanRepository,
} from '@/lib/plans/plan-repository';
import { parseOcrPlan } from '@/lib/plans/parse-ocr-plan';
import type { ParsedPlan, PlanStatus } from '@/lib/plans/types';
import {
  DocumentOcrError,
  recognizePlanDocument,
  type DocumentOcrResult,
} from '@/lib/upstage/document-ocr';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9:_-]{16,128}$/;

export type AnalyzePlanInput = {
  userId: string;
  organizationId: string;
  donationId: string;
  idempotencyKey: string;
  file: File;
};

export type AnalyzePlanResult = {
  planId: string;
  status: PlanStatus;
  parsed: ParsedPlan | null;
  duplicate: boolean;
};

export class PlanServiceError extends Error {
  constructor(
    public readonly code:
      | 'invalid_identifier'
      | 'invalid_idempotency_key'
      | 'forbidden'
      | 'invalid_file'
      | 'retry_unavailable'
      | 'analysis_failed'
      | 'persistence_failed',
    message: string,
    public readonly httpStatus: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'PlanServiceError';
  }
}

export async function retryPlanAnalysis(
  planId: string,
  dependencies: {
    repository: PlanRepository;
    recognize?: (file: File) => Promise<DocumentOcrResult>;
    now?: () => Date;
  },
): Promise<AnalyzePlanResult> {
  if (!UUID.test(planId)) {
    throw new PlanServiceError(
      'invalid_identifier',
      '집행 계획 식별자가 올바르지 않습니다.',
      400,
    );
  }

  let source;
  try {
    source = await dependencies.repository.claimRetry(planId);
  } catch {
    throw new PlanServiceError(
      'persistence_failed',
      '집행 계획 재분석을 시작할 수 없습니다.',
      500,
      true,
    );
  }

  if (!source) {
    throw new PlanServiceError(
      'retry_unavailable',
      '재시도할 수 있는 실패 상태의 집행 계획이 없습니다.',
      409,
    );
  }

  try {
    const file = await dependencies.repository.downloadSource(source);
    const ocr = await (dependencies.recognize ?? recognizePlanDocument)(file);
    const parsed = parseOcrPlan(
      ocr,
      (dependencies.now ?? (() => new Date()))().toISOString(),
    );
    await dependencies.repository.saveAnalysis(
      source.planId,
      source.sourcePath,
      parsed,
    );

    return {
      planId: source.planId,
      status: 'review_required',
      parsed,
      duplicate: false,
    };
  } catch (error) {
    const code =
      error instanceof DocumentOcrError ? error.code : 'persistence_failed';
    try {
      await dependencies.repository.saveFailure(
        source.planId,
        code,
        source.sourcePath,
      );
    } catch {
      // The analyzing row remains traceable when failure recording also fails.
    }

    if (error instanceof DocumentOcrError) {
      throw new PlanServiceError(
        'analysis_failed',
        error.message,
        error.status && error.status < 500 ? error.status : 502,
        error.retryable,
      );
    }

    throw new PlanServiceError(
      'persistence_failed',
      '집행 계획 재분석 결과를 저장할 수 없습니다.',
      500,
      true,
    );
  }
}

function existingResult(existing: ExistingAnalysis): AnalyzePlanResult {
  return {
    planId: existing.id,
    status: existing.status,
    parsed:
      existing.draft === null
        ? null
        : {
            draft: existing.draft,
            issues: existing.issues,
            metadata: {
              provider: 'upstage',
              apiVersion: '',
              modelVersion: '',
              processedAt: '',
              pageCount: 0,
            },
            pages: [],
          },
    duplicate: true,
  };
}

function safeFileName(name: string) {
  return name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
}

export async function analyzePlan(
  input: AnalyzePlanInput,
  dependencies: {
    repository: PlanRepository;
    recognize?: (file: File) => Promise<DocumentOcrResult>;
    now?: () => Date;
  },
): Promise<AnalyzePlanResult> {
  if (
    !UUID.test(input.organizationId) ||
    !UUID.test(input.donationId) ||
    !UUID.test(input.userId)
  ) {
    throw new PlanServiceError(
      'invalid_identifier',
      '기부처 또는 기부 내역 식별자가 올바르지 않습니다.',
      400,
    );
  }

  if (!IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new PlanServiceError(
      'invalid_idempotency_key',
      '중복 제출 방지 키가 올바르지 않습니다.',
      400,
    );
  }

  const existing = await dependencies.repository.findByIdempotency(
    input.userId,
    input.idempotencyKey,
  );
  if (existing) {
    return existingResult(existing);
  }

  const hasAccess = await dependencies.repository.assertDonationAccess(
    input.organizationId,
    input.donationId,
  );
  if (!hasAccess) {
    throw new PlanServiceError(
      'forbidden',
      '선택한 기부 내역에 집행 계획을 등록할 권한이 없습니다.',
      403,
    );
  }

  let document;
  try {
    document = await validatePlanDocument(input.file);
  } catch (error) {
    if (error instanceof PlanDocumentValidationError) {
      throw new PlanServiceError('invalid_file', error.message, 400);
    }
    throw error;
  }

  let planId: string;
  try {
    planId = await dependencies.repository.createAnalyzingPlan({
      organizationId: input.organizationId,
      donationId: input.donationId,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      fileName: safeFileName(input.file.name),
      document,
    });
  } catch {
    throw new PlanServiceError(
      'persistence_failed',
      '집행 계획 분석을 시작할 수 없습니다.',
      500,
      true,
    );
  }

  let sourcePath: string | undefined;
  try {
    sourcePath = await dependencies.repository.uploadSource(
      planId,
      input.organizationId,
      input.file,
    );
    const ocr = await (dependencies.recognize ?? recognizePlanDocument)(
      input.file,
    );
    const parsed = parseOcrPlan(
      ocr,
      (dependencies.now ?? (() => new Date()))().toISOString(),
    );
    await dependencies.repository.saveAnalysis(planId, sourcePath, parsed);

    return {
      planId,
      status: 'review_required',
      parsed,
      duplicate: false,
    };
  } catch (error) {
    const code =
      error instanceof DocumentOcrError ? error.code : 'persistence_failed';
    try {
      await dependencies.repository.saveFailure(planId, code, sourcePath);
    } catch {
      // Preserve the primary safe error; cleanup is tracked by the analyzing row.
    }

    if (error instanceof DocumentOcrError) {
      throw new PlanServiceError(
        'analysis_failed',
        error.message,
        error.status && error.status < 500 ? error.status : 502,
        error.retryable,
      );
    }

    throw new PlanServiceError(
      'persistence_failed',
      '집행 계획 분석 결과를 저장할 수 없습니다.',
      500,
      true,
    );
  }
}
