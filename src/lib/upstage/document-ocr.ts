const DEFAULT_DOCUMENT_OCR_URL =
  'https://api.upstage.ai/v1/document-digitization';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DOCUMENT_OCR_MODEL = 'ocr';

export type DocumentOcrPage = {
  page: number;
  text: string;
  confidence: number | null;
};

export type DocumentOcrResult = {
  apiVersion: string;
  modelVersion: string;
  pages: DocumentOcrPage[];
};

export type DocumentOcrErrorCode =
  | 'missing_api_key'
  | 'invalid_request'
  | 'authentication_failed'
  | 'payload_too_large'
  | 'rate_limited'
  | 'upstream_rejected'
  | 'upstream_failure'
  | 'timeout'
  | 'network_failure'
  | 'invalid_response';

export class DocumentOcrError extends Error {
  constructor(
    public readonly code: DocumentOcrErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'DocumentOcrError';
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseConfidence(value: unknown) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

export function parseDocumentOcrResponse(value: unknown): DocumentOcrResult {
  if (
    !isRecord(value) ||
    typeof value.apiVersion !== 'string' ||
    typeof value.modelVersion !== 'string' ||
    !Array.isArray(value.pages) ||
    value.pages.length === 0
  ) {
    throw new DocumentOcrError(
      'invalid_response',
      'OCR 응답 형식을 확인할 수 없습니다.',
      true,
    );
  }

  const pages = value.pages.map((page, index): DocumentOcrPage => {
    if (!isRecord(page) || typeof page.text !== 'string') {
      throw new DocumentOcrError(
        'invalid_response',
        'OCR 페이지 응답 형식을 확인할 수 없습니다.',
        true,
      );
    }

    const pageNumber =
      typeof page.page === 'number' &&
      Number.isInteger(page.page) &&
      page.page > 0
        ? page.page
        : index + 1;

    return {
      page: pageNumber,
      text: page.text,
      confidence: parseConfidence(page.confidence),
    };
  });

  return {
    apiVersion: value.apiVersion,
    modelVersion: value.modelVersion,
    pages,
  };
}

function mapStatusError(status: number) {
  if (status === 400) {
    return new DocumentOcrError(
      'invalid_request',
      '계획서 형식 또는 요청 값을 확인해 주세요.',
      false,
      status,
    );
  }

  if (status === 401 || status === 403) {
    return new DocumentOcrError(
      'authentication_failed',
      '문서 분석 서비스 인증에 실패했습니다.',
      false,
      status,
    );
  }

  if (status === 413) {
    return new DocumentOcrError(
      'payload_too_large',
      '문서 분석 서비스의 파일 제한을 초과했습니다.',
      false,
      status,
    );
  }

  if (status === 429) {
    return new DocumentOcrError(
      'rate_limited',
      '문서 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      true,
      status,
    );
  }

  if (status >= 400 && status < 500) {
    return new DocumentOcrError(
      'upstream_rejected',
      '문서 분석 서비스가 요청을 처리할 수 없습니다.',
      false,
      status,
    );
  }

  return new DocumentOcrError(
    'upstream_failure',
    '문서 분석 서비스에서 응답하지 않았습니다.',
    status >= 500,
    status,
  );
}

export async function recognizePlanDocument(
  file: File,
  options: {
    apiKey?: string;
    model?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<DocumentOcrResult> {
  const apiKey = options.apiKey ?? process.env.UPSTAGE_API_KEY;

  if (!apiKey?.trim()) {
    throw new DocumentOcrError(
      'missing_api_key',
      '문서 분석 서비스가 구성되지 않았습니다.',
      false,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const body = new FormData();
  body.append('document', file);
  const configuredModel =
    process.env.UPSTAGE_OCR_MODEL?.trim() || process.env.UPSTAGE_MODEL?.trim();
  body.append(
    'model',
    options.model ??
      (configuredModel === DEFAULT_DOCUMENT_OCR_MODEL
        ? configuredModel
        : DEFAULT_DOCUMENT_OCR_MODEL),
  );

  try {
    const endpoint =
      process.env.UPSTAGE_OCR_URL?.trim() || DEFAULT_DOCUMENT_OCR_URL;
    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw mapStatusError(response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new DocumentOcrError(
        'invalid_response',
        'OCR 응답을 읽을 수 없습니다.',
        true,
      );
    }

    return parseDocumentOcrResponse(payload);
  } catch (error) {
    if (error instanceof DocumentOcrError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DocumentOcrError(
        'timeout',
        '문서 분석 시간이 초과되었습니다.',
        true,
      );
    }

    throw new DocumentOcrError(
      'network_failure',
      '문서 분석 서비스에 연결할 수 없습니다.',
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const recognizeDocument = recognizePlanDocument;
