import {
  ExecutionDuplicateError,
  ExecutionIdempotencyConflictError,
  type ExecutionEligibility,
  type ExecutionRepository,
} from '@/lib/executions/execution-repository';
import {
  ReceiptDocumentValidationError,
  validateReceiptDocument,
} from '@/lib/executions/receipt-file-validation';
import {
  parseOcrReceipt,
  receiptSemanticKey,
} from '@/lib/executions/parse-ocr-receipt';
import { verifyReceipt } from '@/lib/executions/receipt-verification';
import type { ExecutionStatus, ParsedReceipt } from '@/lib/executions/types';
import {
  DocumentOcrError,
  recognizeDocument,
  type DocumentOcrResult,
} from '@/lib/upstage/document-ocr';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9:_-]{16,128}$/;

export type AnalyzeExecutionInput = {
  userId: string;
  organizationId: string;
  donationId: string;
  planId: string;
  planItemId: string;
  idempotencyKey: string;
  sourcePath: string;
  fileName: string;
  mimeType: string;
};

export type AnalyzeExecutionResult = {
  executionId: string;
  status: ExecutionStatus;
  parsed: ParsedReceipt | null;
  duplicate: boolean;
};

export class ExecutionServiceError extends Error {
  constructor(
    public readonly code:
      | 'invalid_identifier'
      | 'invalid_idempotency_key'
      | 'forbidden'
      | 'invalid_file'
      | 'duplicate_receipt'
      | 'retry_unavailable'
      | 'analysis_failed'
      | 'persistence_failed',
    message: string,
    public readonly httpStatus: number,
    public readonly retryable = false,
    public readonly executionId?: string,
  ) {
    super(message);
    this.name = 'ExecutionServiceError';
  }
}

function safeFileName(name: string) {
  return name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
}

function isPendingPath(input: AnalyzeExecutionInput) {
  const extension =
    input.mimeType === 'application/pdf'
      ? 'pdf'
      : input.mimeType === 'image/png'
        ? 'png'
        : input.mimeType === 'image/jpeg'
          ? 'jpg'
          : '';
  const prefix = `${input.organizationId}/pending/${input.userId}/`;
  const suffix = `/source.${extension}`;
  const uploadId = input.sourcePath.slice(
    prefix.length,
    input.sourcePath.length - suffix.length,
  );
  return Boolean(
    extension &&
    input.sourcePath.startsWith(prefix) &&
    input.sourcePath.endsWith(suffix) &&
    UUID.test(uploadId),
  );
}

async function cleanup(repository: ExecutionRepository, sourcePath: string) {
  try {
    await repository.removeSource(sourcePath);
  } catch {
    // Storage lifecycle cleanup remains the fallback.
  }
}

function mapPersistenceError(error: unknown) {
  if (
    error instanceof ExecutionDuplicateError ||
    error instanceof ExecutionIdempotencyConflictError
  ) {
    return new ExecutionServiceError(
      'duplicate_receipt',
      error.message,
      409,
      false,
    );
  }
  return new ExecutionServiceError(
    'persistence_failed',
    '집행 내역 분석을 시작할 수 없습니다.',
    500,
    true,
  );
}

async function analyzeStoredSource(
  executionId: string,
  eligibility: ExecutionEligibility,
  file: File,
  sourcePath: string,
  fingerprint: string,
  dependencies: {
    repository: ExecutionRepository;
    recognize?: (file: File) => Promise<DocumentOcrResult>;
    now?: () => Date;
  },
) {
  const ocr = await (dependencies.recognize ?? recognizeDocument)(file);
  const parsed = parseOcrReceipt(
    ocr,
    (dependencies.now ?? (() => new Date()))().toISOString(),
  );
  const semanticKey = receiptSemanticKey(parsed.draft);
  const context = await dependencies.repository.verificationContext(
    eligibility,
    fingerprint,
    semanticKey,
    executionId,
  );
  const verificationResults = verifyReceipt(
    parsed.draft,
    parsed.issues,
    context,
  );
  const status = await dependencies.repository.saveAnalysis(
    executionId,
    sourcePath,
    parsed,
    verificationResults,
    semanticKey,
  );
  return { parsed, status };
}

export async function analyzeExecution(
  input: AnalyzeExecutionInput,
  dependencies: {
    repository: ExecutionRepository;
    recognize?: (file: File) => Promise<DocumentOcrResult>;
    now?: () => Date;
  },
): Promise<AnalyzeExecutionResult> {
  if (
    !UUID.test(input.userId) ||
    !UUID.test(input.organizationId) ||
    !UUID.test(input.donationId) ||
    !UUID.test(input.planId) ||
    !UUID.test(input.planItemId)
  ) {
    throw new ExecutionServiceError(
      'invalid_identifier',
      '기부처, 기부, 계획 또는 예산 항목 식별자가 올바르지 않습니다.',
      400,
    );
  }
  if (!IDEMPOTENCY_KEY.test(input.idempotencyKey)) {
    throw new ExecutionServiceError(
      'invalid_idempotency_key',
      '중복 제출 방지 키가 올바르지 않습니다.',
      400,
    );
  }
  if (!isPendingPath(input) || !safeFileName(input.fileName)) {
    throw new ExecutionServiceError(
      'invalid_file',
      '업로드된 영수증 경로가 올바르지 않습니다.',
      400,
    );
  }

  const eligibility = await dependencies.repository.getEligibility(
    input.organizationId,
    input.donationId,
    input.planId,
    input.planItemId,
  );
  if (!eligibility) {
    await cleanup(dependencies.repository, input.sourcePath);
    throw new ExecutionServiceError(
      'forbidden',
      '선택한 기부 내역과 계획 항목에 집행을 등록할 권한이 없습니다.',
      403,
    );
  }

  let file: File;
  try {
    file = await dependencies.repository.downloadPendingSource(
      input.sourcePath,
      safeFileName(input.fileName),
      input.mimeType,
    );
  } catch {
    throw new ExecutionServiceError(
      'invalid_file',
      '업로드된 영수증을 읽을 수 없습니다.',
      400,
    );
  }

  let document;
  try {
    document = await validateReceiptDocument(file);
  } catch (error) {
    await cleanup(dependencies.repository, input.sourcePath);
    if (error instanceof ReceiptDocumentValidationError) {
      throw new ExecutionServiceError('invalid_file', error.message, 400);
    }
    throw error;
  }

  let creation;
  try {
    creation = await dependencies.repository.createAnalyzingExecution({
      organizationId: input.organizationId,
      donationId: input.donationId,
      planId: input.planId,
      planItemId: input.planItemId,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      fileName: safeFileName(input.fileName),
      document,
    });
  } catch (error) {
    await cleanup(dependencies.repository, input.sourcePath);
    throw mapPersistenceError(error);
  }

  if (!creation.shouldProcess) {
    await cleanup(dependencies.repository, input.sourcePath);
    return {
      executionId: creation.id,
      status: creation.status,
      parsed: null,
      duplicate: true,
    };
  }

  let sourcePath: string | undefined;
  try {
    sourcePath = await dependencies.repository.promoteSource(
      creation.id,
      input.organizationId,
      input.sourcePath,
      file,
      creation.sourcePath,
    );
    const analyzed = await analyzeStoredSource(
      creation.id,
      eligibility,
      file,
      sourcePath,
      document.fingerprint,
      dependencies,
    );
    return {
      executionId: creation.id,
      status: analyzed.status,
      parsed: analyzed.parsed,
      duplicate: false,
    };
  } catch (error) {
    const code =
      error instanceof DocumentOcrError
        ? error.code
        : error instanceof ExecutionDuplicateError
          ? 'duplicate_receipt'
          : 'persistence_failed';
    try {
      await dependencies.repository.saveFailure(creation.id, code, sourcePath);
    } catch {
      // Preserve the primary safe failure.
    }
    if (error instanceof ExecutionDuplicateError) {
      throw new ExecutionServiceError(
        'duplicate_receipt',
        error.message,
        409,
        false,
        creation.id,
      );
    }
    if (error instanceof DocumentOcrError) {
      throw new ExecutionServiceError(
        'analysis_failed',
        error.message,
        error.status && error.status < 500 ? error.status : 502,
        error.retryable,
        creation.id,
      );
    }
    throw new ExecutionServiceError(
      'persistence_failed',
      '영수증 분석 결과를 저장할 수 없습니다.',
      500,
      true,
      creation.id,
    );
  }
}

export async function retryExecutionAnalysis(
  executionId: string,
  dependencies: {
    repository: ExecutionRepository;
    recognize?: (file: File) => Promise<DocumentOcrResult>;
    now?: () => Date;
  },
): Promise<AnalyzeExecutionResult> {
  if (!UUID.test(executionId)) {
    throw new ExecutionServiceError(
      'invalid_identifier',
      '집행 내역 식별자가 올바르지 않습니다.',
      400,
    );
  }
  const source = await dependencies.repository.claimRetry(executionId);
  if (!source) {
    throw new ExecutionServiceError(
      'retry_unavailable',
      '재시도할 수 있는 집행 내역이 없습니다.',
      409,
    );
  }
  const eligibility = await dependencies.repository.getEligibility(
    source.organizationId,
    source.donationId,
    source.planId,
    source.planItemId,
  );
  if (!eligibility) {
    throw new ExecutionServiceError(
      'forbidden',
      '집행 참조가 유효하지 않습니다.',
      403,
    );
  }
  try {
    const file = await dependencies.repository.downloadSource(source);
    const analyzed = await analyzeStoredSource(
      executionId,
      eligibility,
      file,
      source.sourcePath,
      source.fingerprint,
      dependencies,
    );
    return {
      executionId,
      status: analyzed.status,
      parsed: analyzed.parsed,
      duplicate: false,
    };
  } catch (error) {
    await dependencies.repository.saveFailure(
      executionId,
      error instanceof DocumentOcrError ? error.code : 'persistence_failed',
      source.sourcePath,
    );
    if (error instanceof DocumentOcrError) {
      throw new ExecutionServiceError(
        'analysis_failed',
        error.message,
        502,
        error.retryable,
        executionId,
      );
    }
    throw new ExecutionServiceError(
      'persistence_failed',
      '영수증 재분석 결과를 저장할 수 없습니다.',
      500,
      true,
      executionId,
    );
  }
}
