export type ReportStatus =
  'generating' | 'review_required' | 'generation_failed' | 'published';

export type ReportEvidenceItem = {
  id: string;
  name: string;
  description: string;
  plannedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  executionIds: string[];
};

export type ReportEvidenceExecution = {
  id: string;
  planItemId: string;
  merchantName: string;
  transactionDate: string;
  totalAmount: number;
};

export type ReportEvidence = {
  version: 1;
  organizationId: string;
  donationId: string;
  pledgeId: string;
  purpose: string;
  donationCondition: string;
  plan: {
    id: string;
    title: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    spentAmount: number;
    remainingAmount: number;
    executionCount: number;
    items: ReportEvidenceItem[];
  };
  executions: ReportEvidenceExecution[];
};

export type ReportNarrative = {
  text: string;
  evidenceIds: string[];
};

export type ReportItemNarrative = ReportNarrative & {
  planItemId: string;
  title: string;
};

export type ReportContent = {
  version: 1;
  title: string;
  summary: ReportNarrative;
  planComparison: ReportNarrative;
  items: ReportItemNarrative[];
  outcomes: ReportNarrative;
  nextSteps: ReportNarrative;
};

export type ReportValidationIssue = {
  code:
    | 'invalid_shape'
    | 'required'
    | 'too_long'
    | 'html_not_allowed'
    | 'numeric_claim_not_allowed'
    | 'unknown_evidence'
    | 'missing_evidence'
    | 'item_mismatch';
  path: string;
  message: string;
};

export type SolarReportMetadata = {
  provider: 'upstage';
  model: string;
  apiVersion: string;
  promptVersion: 1;
  processedAt: string;
};

export type EligibleReportDonation = {
  organizationId: string;
  organizationName: string;
  donationId: string;
  pledgeId: string;
  planId: string;
  planTitle: string;
  purpose: string;
  periodStart: string;
  periodEnd: string;
  executionCount: number;
};

export type ReportListItem = {
  id: string;
  title: string;
  status: ReportStatus;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  generationLeaseExpiresAt: string | null;
  retryAvailable: boolean;
};

export type ReportReview = {
  id: string;
  status: ReportStatus;
  title: string;
  evidence: ReportEvidence;
  content: ReportContent | null;
  issues: ReportValidationIssue[];
  generationErrorCode: string;
  retryAvailable: boolean;
  publishedAt: string | null;
};

export type PublishedDonationReport = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  evidence_snapshot: unknown;
  published_content: unknown;
  published_at: string;
};
