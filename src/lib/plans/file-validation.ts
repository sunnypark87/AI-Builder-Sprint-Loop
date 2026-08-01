import { PDFDocument } from 'pdf-lib';

const KIB = 1024;

export const PLAN_DOCUMENT_LIMITS = {
  maxBytes: 10 * KIB * KIB,
  maxPdfPages: 30,
} as const;

export const ACCEPTED_PLAN_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export type PlanDocumentType = (typeof ACCEPTED_PLAN_DOCUMENT_TYPES)[number];

export type ValidatedPlanDocument = {
  type: PlanDocumentType;
  size: number;
  pageCount: number;
  fingerprint: string;
};

export class PlanDocumentValidationError extends Error {
  constructor(
    public readonly code:
      | 'empty_file'
      | 'file_too_large'
      | 'unsupported_type'
      | 'invalid_signature'
      | 'invalid_pdf'
      | 'pdf_page_limit',
    message: string,
  ) {
    super(message);
    this.name = 'PlanDocumentValidationError';
  }
}

function matchesSignature(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function detectType(bytes: Uint8Array): PlanDocumentType | null {
  if (matchesSignature(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf';
  }

  if (
    matchesSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return 'image/png';
  }

  if (matchesSignature(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }

  return null;
}

async function countPdfPages(bytes: Uint8Array) {
  try {
    const document = await PDFDocument.load(bytes, {
      updateMetadata: false,
    });
    return document.getPageCount();
  } catch {
    throw new PlanDocumentValidationError(
      'invalid_pdf',
      'PDF 파일을 읽을 수 없습니다.',
    );
  }
}

async function fingerprint(bytes: Uint8Array) {
  const source = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', source.buffer);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
}

export async function validatePlanDocument(
  file: File,
): Promise<ValidatedPlanDocument> {
  if (file.size === 0) {
    throw new PlanDocumentValidationError(
      'empty_file',
      '비어 있는 파일은 업로드할 수 없습니다.',
    );
  }

  if (file.size > PLAN_DOCUMENT_LIMITS.maxBytes) {
    throw new PlanDocumentValidationError(
      'file_too_large',
      '계획서는 10MB 이하만 업로드할 수 있습니다.',
    );
  }

  if (!ACCEPTED_PLAN_DOCUMENT_TYPES.includes(file.type as PlanDocumentType)) {
    throw new PlanDocumentValidationError(
      'unsupported_type',
      'PDF, JPG, PNG 파일만 업로드할 수 있습니다.',
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectType(bytes);

  if (!detectedType || detectedType !== file.type) {
    throw new PlanDocumentValidationError(
      'invalid_signature',
      '파일 내용과 형식이 일치하지 않습니다.',
    );
  }

  const pageCount =
    detectedType === 'application/pdf' ? await countPdfPages(bytes) : 1;

  if (pageCount > PLAN_DOCUMENT_LIMITS.maxPdfPages) {
    throw new PlanDocumentValidationError(
      'pdf_page_limit',
      `PDF는 ${PLAN_DOCUMENT_LIMITS.maxPdfPages}페이지 이하만 업로드할 수 있습니다.`,
    );
  }

  return {
    type: detectedType,
    size: file.size,
    pageCount,
    fingerprint: await fingerprint(bytes),
  };
}
