import type { DocumentOcrPage } from '@/lib/upstage/document-ocr';

export const RECEIPT_OCR_CONFIDENCE_THRESHOLD = 0.8;

export type ExecutionStatus =
  | 'analyzing'
  | 'review_required'
  | 'verification_warning'
  | 'registered'
  | 'analysis_failed';

export type ReceiptItemDraft = {
  id: string;
  name: string;
  quantity: number | null;
  amount: number | null;
  confidence: number | null;
  sourceText: string;
  sourceName: string;
  sourceAmount: number | null;
};

export type ReceiptDraft = {
  merchantName: string;
  businessNumber: string;
  transactionAt: string;
  supplyAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  paymentMethod: string;
  approvalNumber: string;
  items: ReceiptItemDraft[];
};

export type ReceiptIssueCode =
  | 'merchant_required'
  | 'merchant_too_long'
  | 'transaction_at_required'
  | 'transaction_at_invalid'
  | 'business_number_invalid'
  | 'amount_invalid'
  | 'total_required'
  | 'items_too_many'
  | 'item_name_required'
  | 'item_name_too_long'
  | 'item_quantity_invalid'
  | 'item_amount_invalid'
  | 'ocr_confidence_low';

export type ReceiptValidationIssue = {
  code: ReceiptIssueCode;
  message: string;
  path: string;
};

export type ReceiptOcrMetadata = {
  provider: 'upstage';
  apiVersion: string;
  modelVersion: string;
  processedAt: string;
  pageCount: number;
};

export type ParsedReceipt = {
  draft: ReceiptDraft;
  issues: ReceiptValidationIssue[];
  metadata: ReceiptOcrMetadata;
  pages: DocumentOcrPage[];
};

export type VerificationOutcome = 'passed' | 'warning' | 'blocked';

export type ReceiptVerificationCode =
  | 'receipt_arithmetic'
  | 'item_total'
  | 'business_number_checksum'
  | 'plan_period'
  | 'donation_paid_at'
  | 'remaining_budget'
  | 'duplicate_source'
  | 'duplicate_transaction'
  | 'ocr_review';

export type ReceiptVerificationResult = {
  code: ReceiptVerificationCode;
  version: 1;
  outcome: VerificationOutcome;
  message: string;
  evidence: string;
};

export type ReceiptVerificationContext = {
  planPeriodStart: string;
  planPeriodEnd: string;
  donationPaidAt: string | null;
  remainingBudget: number;
  duplicateSource: boolean;
  duplicateTransaction: boolean;
  sourceFingerprint: string;
};

export type ExecutionListItem = {
  id: string;
  merchantName: string;
  status: ExecutionStatus;
  totalAmount: number | null;
  transactionAt: string | null;
  planItemName: string;
  updatedAt: string;
  analysisLeaseExpiresAt: string | null;
  retryAvailable: boolean;
};

export type ExecutionReview = {
  id: string;
  organizationId: string;
  donationId: string;
  planId: string;
  planItemId: string;
  planItemName: string;
  status: ExecutionStatus;
  draft: ReceiptDraft;
  issues: ReceiptValidationIssue[];
  verificationResults: ReceiptVerificationResult[];
  warningReason: string;
  remainingBudget: number;
  sourceFileName: string;
  sourceMimeType: string;
  sourceUrl: string;
  sourceFingerprint: string;
  ocrMetadata: ReceiptOcrMetadata;
};
