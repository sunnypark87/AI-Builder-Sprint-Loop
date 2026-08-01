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
  sourcePath: string | null;
};

export type AnalysisCreation = ExistingAnalysis & {
  shouldProcess: boolean;
};

export type PlanListItem = {
  id: string;
  title: string;
  status: PlanStatus;
  totalAmount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  updatedAt: string;
  canRetry: boolean;
  needsReupload: boolean;
};

export function getPlanRecoveryState(
  status: PlanStatus,
  sourcePath: string | null,
  leaseExpiresAt: string | null,
  analysisErrorCode: string | null = null,
  now = Date.now(),
) {
  const leaseExpired =
    status === 'analyzing' &&
    leaseExpiresAt !== null &&
    new Date(leaseExpiresAt).getTime() <= now;
  const retryableAnalysisErrors = new Set([
    'rate_limited',
    'upstream_failure',
    'timeout',
    'network_failure',
    'invalid_response',
    'persistence_failed',
  ]);
  const recoverableState =
    leaseExpired ||
    (status === 'analysis_failed' &&
      analysisErrorCode !== null &&
      retryableAnalysisErrors.has(analysisErrorCode));
  const requiresNewUpload =
    status === 'analysis_failed' &&
    (analysisErrorCode === 'source_upload_failed' ||
      analysisErrorCode === 'invalid_request' ||
      analysisErrorCode === 'payload_too_large');
  const sourceExists = sourcePath !== null;

  return {
    canRetry: recoverableState && sourceExists,
    needsReupload: (recoverableState && !sourceExists) || requiresNewUpload,
  };
}

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
  assertDonationAccess(
    organizationId: string,
    donationId: string,
  ): Promise<boolean>;
  createAnalyzingPlan(
    input: CreateAnalyzingPlanInput,
  ): Promise<AnalysisCreation>;
  downloadPendingSource(
    sourcePath: string,
    fileName: string,
    mimeType: string,
  ): Promise<File>;
  promoteSource(
    planId: string,
    organizationId: string,
    pendingSourcePath: string,
    file: File,
    existingSourcePath: string | null,
  ): Promise<string>;
  removeSource(sourcePath: string): Promise<void>;
  markSourceUploaded(planId: string, sourcePath: string): Promise<void>;
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
  getAnalysis(planId: string): Promise<ExistingAnalysis | null>;
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

export class PlanIdempotencyConflictError extends Error {
  constructor() {
    super('같은 중복 제출 방지 키에 다른 파일을 사용할 수 없습니다.');
    this.name = 'PlanIdempotencyConflictError';
  }
}

export function createPlanRepository(
  supabase: SupabaseClient,
  mutationContext?: {
    client: SupabaseClient;
    actorUserId: string;
  },
): PlanRepository {
  function mutationClient() {
    if (!mutationContext) {
      throw databaseError('서버 전용 변경 컨텍스트가 없습니다.');
    }
    return mutationContext;
  }

  return {
    async assertDonationAccess(organizationId, donationId) {
      const { data, error } = await supabase
        .from('donations')
        .select('id')
        .eq('id', donationId)
        .eq('organization_id', organizationId)
        .eq('status', 'paid')
        .maybeSingle();

      if (error) {
        throw databaseError(error.message);
      }
      return Boolean(data);
    },

    async createAnalyzingPlan(input) {
      const { client, actorUserId } = mutationClient();
      const { data, error } = await client
        .rpc('create_expenditure_plan_analysis', {
          p_actor_id: actorUserId,
          p_organization_id: input.organizationId,
          p_donation_id: input.donationId,
          p_idempotency_key: input.idempotencyKey,
          p_source_file_name: input.fileName,
          p_source_mime_type: input.document.type,
          p_source_size_bytes: input.document.size,
          p_source_page_count: input.document.pageCount,
          p_source_fingerprint: input.document.fingerprint,
        })
        .single();

      if (error || !data) {
        if (error?.message.includes('idempotency key does not match')) {
          throw new PlanIdempotencyConflictError();
        }
        throw databaseError(error?.message ?? '계획을 만들 수 없습니다.');
      }
      const created = data as {
        plan_id: string;
        plan_status: PlanStatus;
        plan_draft: unknown;
        plan_validation_issues: unknown;
        plan_source_path: string | null;
        should_process: boolean;
      };
      return {
        id: created.plan_id,
        status: created.plan_status,
        draft: parsePlanDraft(created.plan_draft),
        issues: asIssues(created.plan_validation_issues),
        sourcePath: created.plan_source_path,
        shouldProcess: created.should_process,
      };
    },

    async downloadPendingSource(sourcePath, fileName, mimeType) {
      const { client } = mutationClient();
      const { data, error } = await client.storage
        .from(PLAN_DOCUMENT_BUCKET)
        .download(sourcePath);

      if (error || !data) {
        throw databaseError(
          error?.message ?? '업로드 원본을 읽을 수 없습니다.',
        );
      }

      return new File([data], fileName, { type: mimeType });
    },

    async promoteSource(
      planId,
      organizationId,
      pendingSourcePath,
      file,
      existingSourcePath,
    ) {
      const { client } = mutationClient();
      if (existingSourcePath) {
        const { error } = await client.storage
          .from(PLAN_DOCUMENT_BUCKET)
          .remove([pendingSourcePath]);
        if (error) {
          throw databaseError(error.message);
        }
        return existingSourcePath;
      }

      const finalPath = `${organizationId}/${planId}/source.${extensionFor(file.type)}`;
      const { error } = await client.storage
        .from(PLAN_DOCUMENT_BUCKET)
        .move(pendingSourcePath, finalPath);
      if (error) {
        const { data: finalExists } = await client.storage
          .from(PLAN_DOCUMENT_BUCKET)
          .exists(finalPath);
        if (finalExists) {
          const { error: cleanupError } = await client.storage
            .from(PLAN_DOCUMENT_BUCKET)
            .remove([pendingSourcePath]);
          if (cleanupError) {
            throw databaseError(cleanupError.message);
          }
          return finalPath;
        }
        throw databaseError(error.message);
      }
      return finalPath;
    },

    async removeSource(sourcePath) {
      const { client } = mutationClient();
      const { error } = await client.storage
        .from(PLAN_DOCUMENT_BUCKET)
        .remove([sourcePath]);
      if (error) {
        throw databaseError(error.message);
      }
    },

    async markSourceUploaded(planId, sourcePath) {
      const { client, actorUserId } = mutationClient();
      const { error } = await client.rpc('mark_plan_source_uploaded', {
        p_actor_id: actorUserId,
        p_plan_id: planId,
        p_source_path: sourcePath,
      });

      if (error) {
        throw databaseError(error.message);
      }
    },

    async saveAnalysis(planId, sourcePath, parsed) {
      const { client, actorUserId } = mutationClient();
      const { error } = await client.rpc('save_plan_analysis', {
        p_actor_id: actorUserId,
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
      const { client, actorUserId } = mutationClient();
      const { error } = await client.rpc('mark_plan_analysis_failed', {
        p_actor_id: actorUserId,
        p_plan_id: planId,
        p_error_code: errorCode,
        p_source_path: sourcePath,
      });

      if (error) {
        throw databaseError(error.message);
      }
    },

    async claimRetry(planId) {
      const { client, actorUserId } = mutationClient();
      const { data, error } = await client
        .rpc('claim_plan_analysis_retry', {
          p_actor_id: actorUserId,
          p_plan_id: planId,
        })
        .maybeSingle();

      if (error) {
        throw databaseError(error.message);
      }
      if (!data) {
        return null;
      }
      const source = data as {
        plan_id: string;
        organization_id: string;
        source_path: string | null;
        source_file_name: string;
        source_mime_type: string;
      };
      if (!source.source_path) {
        return null;
      }

      return {
        planId: source.plan_id,
        organizationId: source.organization_id,
        sourcePath: source.source_path,
        fileName: source.source_file_name,
        mimeType: source.source_mime_type,
      };
    },

    async getAnalysis(planId) {
      const { data, error } = await supabase
        .from('expenditure_plans')
        .select('id,status,draft_data,validation_issues,source_path')
        .eq('id', planId)
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
        sourcePath: data.source_path as string | null,
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
      const { client, actorUserId } = mutationClient();
      const { error } = await client.rpc('register_expenditure_plan', {
        p_actor_id: actorUserId,
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
          'id,title,status,total_amount,period_start,period_end,updated_at,source_path,analysis_lease_expires_at,analysis_error_code',
        )
        .order('updated_at', { ascending: false });

      if (error) {
        throw databaseError(error.message);
      }

      return (data ?? []).map((plan) => {
        const status = plan.status as PlanStatus;
        const sourcePath =
          typeof plan.source_path === 'string' ? plan.source_path : null;
        const leaseExpiresAt =
          typeof plan.analysis_lease_expires_at === 'string'
            ? plan.analysis_lease_expires_at
            : null;
        const recovery = getPlanRecoveryState(
          status,
          sourcePath,
          leaseExpiresAt,
          typeof plan.analysis_error_code === 'string'
            ? plan.analysis_error_code
            : null,
        );

        return {
          id: plan.id as string,
          title: (plan.title as string | null) || '이름 없는 집행 계획',
          status,
          totalAmount: plan.total_amount as number | null,
          periodStart: plan.period_start as string | null,
          periodEnd: plan.period_end as string | null,
          updatedAt: plan.updated_at as string,
          ...recovery,
        };
      });
    },
  };
}
