export type PlanStatus =
  'analyzing' | 'review_required' | 'registered' | 'analysis_failed';

export type PlanItemDraft = {
  id: string;
  name: string;
  description: string;
  amount: number | null;
  confidence: number | null;
  sourceText: string;
  sourceName: string;
  sourceAmount: number | null;
};

export type PlanDraft = {
  title: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number | null;
  items: PlanItemDraft[];
};

export type PlanIssueCode =
  | 'title_required'
  | 'period_start_required'
  | 'period_end_required'
  | 'period_invalid'
  | 'title_too_long'
  | 'items_required'
  | 'items_too_many'
  | 'item_name_required'
  | 'item_name_too_long'
  | 'item_description_too_long'
  | 'item_amount_invalid'
  | 'total_amount_required'
  | 'total_amount_mismatch';

export type PlanValidationIssue = {
  code: PlanIssueCode;
  message: string;
  path: string;
};

export type OcrPageText = {
  page: number;
  text: string;
  confidence: number | null;
};

export type PlanOcrMetadata = {
  provider: 'upstage';
  apiVersion: string;
  modelVersion: string;
  processedAt: string;
  pageCount: number;
};

export type ParsedPlan = {
  draft: PlanDraft;
  issues: PlanValidationIssue[];
  metadata: PlanOcrMetadata;
  pages: OcrPageText[];
};
