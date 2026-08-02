import {
  PlanDocumentValidationError,
  validatePlanDocument,
  type PlanDocumentType,
} from '@/lib/plans/file-validation';

export const RECEIPT_DOCUMENT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxPdfPages: 30,
} as const;

export const ACCEPTED_RECEIPT_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const satisfies readonly PlanDocumentType[];

export type ReceiptDocumentType =
  (typeof ACCEPTED_RECEIPT_DOCUMENT_TYPES)[number];

export class ReceiptDocumentValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReceiptDocumentValidationError';
  }
}

export async function validateReceiptDocument(file: File) {
  try {
    return await validatePlanDocument(file);
  } catch (error) {
    if (error instanceof PlanDocumentValidationError) {
      throw new ReceiptDocumentValidationError(
        error.code,
        error.message.replace('계획서', '영수증'),
      );
    }
    throw error;
  }
}
