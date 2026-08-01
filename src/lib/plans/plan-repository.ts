import type { SupabaseClient } from '@supabase/supabase-js';

import { parsePlanDraft } from '@/lib/plans/plan-schema';
import type {
  ParsedPlan,
  PlanDraft,
  PlanStatus,
  PlanValidationIssue,
} from '@/lib/plans/types';
import type { ValidatedPlanDocument } from '@/lib/plans/file-validation';

export const PLAN_DOCUMENT_BUCKET = 'plan-documents';

export type ExistingAnalysis = {
  id: string;
  status: PlanStatus;
  draft: PlanDraft | null;
  issues: PlanValidationIssue[];
};

export type PlanListItem = {
  id: string;
  title: string;
  status: PlanStatus;
  totalAmount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  updatedAt: string;
};

export type PlanReview = {
  id: string;
  organizationId: string;
  donationId: string;
  status: PlanStatus;
  draft: PlanDraft;
  issues: PlanValidationIssue[];
  sourceFileName: string;
  sourceMimeType: string;
  sourceUrl: string;
  ocrMetadata: ParsedPlan['metadata'];
};

export type CreateAnalyzingPlanInput = {
  organizationId: string;
  donationId: string;
  userId: string;
  idempotencyKey: string;
  fileName: string;
  document: ValidatedPlanDocument;
};

export type RetrySource = {
  planId: string;
  organizationId: string;
  sourcePath: string;
  fileName: string;
  mimeType: string;
};

export interface PlanRepository {
  findByIdempotency(
    userId: string,
    idempotencyKey: string,
  ): Promise<ExistingAnalysis | null>;
  assertDonationAccess(
    organizationId: string,
    donationId: string,
  ): Promise<boolean>;
  createAnalyzingPlan(input: CreateAnalyzingPlanInput): Promise<string>;
  uploadSource(
    planId: string,
    organizationId: string,
    file: File,
  ): Promise<string>;
  saveAnalysis(
    planId: string,
    sourcePath: string,
    parsed: ParsedPlan,
  ): Promise<void>;
  saveFailure(
    planId: string,
    errorCode: string,
    sourcePath?: string,
  ): Promise<void>;
  claimRetry(planId: string): Promise<RetrySource | null>;
  downloadSource(source: RetrySource): Promise<File>;
  getReview(planId: string): Promise<PlanReview | null>;
  register(planId: string, draft: PlanDraft): Promise<void>;
  list(): Promise<PlanListItem[]>;
}

function asIssues(value: unknown): PlanValidationIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (issue): issue is PlanValidationIssue =>
      typeof issue === 'object' &&
      issue !== null &&
      typeof (issue as PlanValidationIssue).code === 'string' &&
      typeof (issue as PlanValidationIssue).message === 'string' &&
      typeof (issue as PlanValidationIssue).path === 'string',
  );
}

function extensionFor(type: string) {
  if (type === 'application/pdf') {
    return 'pdf';
  }
  if (type === 'image/png') {
    return 'png';
  }
  return 'jpg';
}

function databaseError(message: string) {
  return new Error(`집행 계획 저장소 오류: ${message}`);
}

export function createPlanRepository(supabase: SupabaseClient): PlanRepository {
  return {
    async findByIdempotency(userId, idempotencyKey) {
      const { data, error } = await supabase
        .from('expenditure_plans')
        .select('id,status,draft_data,validation_issues')
        .eq('created_by', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (error) {
        throw databaseError(error.message);
      }
      if (!data) {
        return null;
      }

      return {
        id: data.id as string,
        status: data.status as PlanStatus,
        draft: parsePlanDraft(data.draft_data),
        issues: asIssues(data.validation_issues),
      };
    },

    async assertDonationAccess(organizationId, donationId) {
      const { data, error } = await supabase
        .from('donations')
        .select('id')
        .eq('id', donationId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        throw databaseError(error.message);
      }
      return Boolean(data);
    },

    async createAnalyzingPlan(input) {
      const { data, error } = await supabase
        .from('expenditure_plans')
        .insert({
          organization_id: input.organizationId,
          donation_id: input.donationId,
          created_by: input.userId,
          status: 'analyzing',
          source_file_name: input.fileName,
          source_mime_type: input.document.type,
          source_size_bytes: input.document.size,
          source_page_count: input.document.pageCount,
          source_fingerprint: input.document.fingerprint,
          idempotency_key: input.idempotencyKey,
        })
        .select('id')
        .single();

      if (error || !data) {
        throw databaseError(error?.message ?? '계획을 만들 수 없습니다.');
      }
      return data.id as string;
    },

    async uploadSource(planId, organizationId, file) {
      const path = `${organizationId}/${planId}/source.${extensionFor(file.type)}`;
      const { error } = await supabase.storage
        .from(PLAN_DOCUMENT_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        throw databaseError(error.message);
      }
      return path;
    },

    async saveAnalysis(planId, sourcePath, parsed) {
      const { error } = await supabase.rpc('save_plan_analysis', {
        p_plan_id: planId,
        p_source_path: sourcePath,
        p_draft: parsed.draft,
        p_validation_issues: parsed.issues,
        p_ocr_metadata: parsed.metadata,
      });

      if (error) {
        throw databaseError(error.message);
      }
    },

    async saveFailure(planId, errorCode, sourcePath) {
      const { error } = await supabase
        .from('expenditure_plans')
        .update({
          status: 'analysis_failed',
          analysis_error_code: errorCode,
          ...(sourcePath ? { source_path: sourcePath } : {}),
        })
        .eq('id', planId)
        .eq('status', 'analyzing');

      if (error) {
        throw databaseError(error.message);
      }
    },

    async claimRetry(planId) {
      const { data, error } = await supabase
        .from('expenditure_plans')
        .update({ status: 'analyzing', analysis_error_code: null })
        .eq('id', planId)
        .eq('status', 'analysis_failed')
        .not('source_path', 'is', null)
        .select(
          'id,organization_id,source_path,source_file_name,source_mime_type',
        )
        .maybeSingle();

      if (error) {
        throw databaseError(error.message);
      }
      if (!data?.source_path) {
        return null;
      }

      return {
        planId: data.id as string,
        organizationId: data.organization_id as string,
        sourcePath: data.source_path as string,
        fileName: data.source_file_name as string,
        mimeType: data.source_mime_type as string,
      };
    },

    async downloadSource(source) {
      const { data, error } = await supabase.storage
        .from(PLAN_DOCUMENT_BUCKET)
        .download(source.sourcePath);

      if (error || !data) {
        throw databaseError(error?.message ?? '원본 문서를 읽을 수 없습니다.');
      }

      return new File([data], source.fileName, { type: source.mimeType });
    },

    async getReview(planId) {
      const { data, error } = await supabase
        .from('expenditure_plans')
        .select(
          'id,organization_id,donation_id,status,draft_data,validation_issues,source_file_name,source_mime_type,source_path,ocr_metadata',
        )
        .eq('id', planId)
        .maybeSingle();

      if (error) {
        throw databaseError(error.message);
      }
      if (!data) {
        return null;
      }

      const draft = parsePlanDraft(data.draft_data);
      if (!draft || !data.source_path) {
        throw databaseError('검토할 분석 결과가 올바르지 않습니다.');
      }

      const { data: signed, error: signedError } = await supabase.storage
        .from(PLAN_DOCUMENT_BUCKET)
        .createSignedUrl(data.source_path as string, 300);

      if (signedError || !signed) {
        throw databaseError(
          signedError?.message ?? '원본 문서를 열 수 없습니다.',
        );
      }

      return {
        id: data.id as string,
        organizationId: data.organization_id as string,
        donationId: data.donation_id as string,
        status: data.status as PlanStatus,
        draft,
        issues: asIssues(data.validation_issues),
        sourceFileName: data.source_file_name as string,
        sourceMimeType: data.source_mime_type as string,
        sourceUrl: signed.signedUrl,
        ocrMetadata: data.ocr_metadata as ParsedPlan['metadata'],
      };
    },

    async register(planId, draft) {
      const { error } = await supabase.rpc('register_expenditure_plan', {
        p_plan_id: planId,
        p_draft: draft,
      });

      if (error) {
        throw databaseError(error.message);
      }
    },

    async list() {
      const { data, error } = await supabase
        .from('expenditure_plans')
        .select(
          'id,title,status,total_amount,period_start,period_end,updated_at',
        )
        .order('updated_at', { ascending: false });

      if (error) {
        throw databaseError(error.message);
      }

      return (data ?? []).map((plan) => ({
        id: plan.id as string,
        title: (plan.title as string | null) || '이름 없는 집행 계획',
        status: plan.status as PlanStatus,
        totalAmount: plan.total_amount as number | null,
        periodStart: plan.period_start as string | null,
        periodEnd: plan.period_end as string | null,
        updatedAt: plan.updated_at as string,
      }));
    },
  };
}
