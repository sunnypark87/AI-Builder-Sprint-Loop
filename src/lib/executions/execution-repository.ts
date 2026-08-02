import type { SupabaseClient } from '@supabase/supabase-js';

import { parseReceiptDraft } from '@/lib/executions/receipt-schema';
import type {
  ExecutionListItem,
  ExecutionReview,
  ExecutionStatus,
  ParsedReceipt,
  ReceiptDraft,
  ReceiptValidationIssue,
  ReceiptVerificationContext,
  ReceiptVerificationResult,
} from '@/lib/executions/types';
import type { ValidatedPlanDocument } from '@/lib/plans/file-validation';

export const RECEIPT_DOCUMENT_BUCKET = 'receipt-documents';

export type ExecutionEligibility = {
  organizationId: string;
  donationId: string;
  planId: string;
  planTitle: string;
  planItemId: string;
  planItemName: string;
  planPeriodStart: string;
  planPeriodEnd: string;
  donationPaidAt: string | null;
  planItemAmount: number;
  remainingBudget: number;
};

export type EligibleExecutionOption = ExecutionEligibility & {
  donationAmount: number;
};

export type ExistingExecutionAnalysis = {
  id: string;
  status: ExecutionStatus;
  draft: ReceiptDraft | null;
  issues: ReceiptValidationIssue[];
  verificationResults: ReceiptVerificationResult[];
  sourcePath: string | null;
  leaseToken: string | null;
  shouldProcess: boolean;
};

export type CreateExecutionInput = {
  organizationId: string;
  donationId: string;
  planId: string;
  planItemId: string;
  userId: string;
  idempotencyKey: string;
  fileName: string;
  document: ValidatedPlanDocument;
};

export type ExecutionRetrySource = {
  executionId: string;
  organizationId: string;
  donationId: string;
  planId: string;
  planItemId: string;
  sourcePath: string;
  fileName: string;
  mimeType: string;
  fingerprint: string;
  leaseToken: string;
};

export interface ExecutionRepository {
  getEligibility(
    organizationId: string,
    donationId: string,
    planId: string,
    planItemId: string,
  ): Promise<ExecutionEligibility | null>;
  listEligible(): Promise<EligibleExecutionOption[]>;
  createAnalyzingExecution(
    input: CreateExecutionInput,
  ): Promise<ExistingExecutionAnalysis>;
  downloadPendingSource(
    sourcePath: string,
    fileName: string,
    mimeType: string,
  ): Promise<File>;
  promoteSource(
    executionId: string,
    organizationId: string,
    pendingSourcePath: string,
    file: File,
    existingSourcePath: string | null,
  ): Promise<string>;
  removeSource(sourcePath: string): Promise<void>;
  markSourceUploaded(
    executionId: string,
    sourcePath: string,
    leaseToken: string,
  ): Promise<void>;
  saveAnalysis(
    executionId: string,
    leaseToken: string,
    sourcePath: string,
    parsed: ParsedReceipt,
    verificationResults: ReceiptVerificationResult[],
    semanticKey: string,
  ): Promise<ExecutionStatus>;
  saveFailure(
    executionId: string,
    leaseToken: string,
    errorCode: string,
    sourcePath?: string,
  ): Promise<void>;
  verificationContext(
    eligibility: ExecutionEligibility,
    sourceFingerprint: string,
    semanticKey: string,
    excludeExecutionId: string,
  ): Promise<ReceiptVerificationContext>;
  getReview(executionId: string): Promise<ExecutionReview | null>;
  register(
    executionId: string,
    planItemId: string,
    draft: ReceiptDraft,
    verificationResults: ReceiptVerificationResult[],
    warningReason: string,
  ): Promise<void>;
  list(): Promise<ExecutionListItem[]>;
  claimRetry(executionId: string): Promise<ExecutionRetrySource | null>;
  downloadSource(source: ExecutionRetrySource): Promise<File>;
}

function databaseError(message: string) {
  return new Error(`집행 내역 저장소 오류: ${message}`);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function extensionFor(type: string) {
  if (type === 'application/pdf') return 'pdf';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

export class ExecutionDuplicateError extends Error {
  constructor(
    message = '동일하거나 핵심 거래 정보가 같은 영수증이 이미 있습니다.',
  ) {
    super(message);
    this.name = 'ExecutionDuplicateError';
  }
}

export class ExecutionIdempotencyConflictError extends Error {
  constructor() {
    super('같은 중복 제출 방지 키에 다른 영수증을 사용할 수 없습니다.');
    this.name = 'ExecutionIdempotencyConflictError';
  }
}

export function createExecutionRepository(
  supabase: SupabaseClient,
  mutationContext?: { client: SupabaseClient; actorUserId: string },
): ExecutionRepository {
  function mutationClient() {
    if (!mutationContext) {
      throw databaseError('서버 전용 변경 컨텍스트가 없습니다.');
    }
    return mutationContext;
  }

  async function eligibilityFromIds(
    organizationId: string,
    donationId: string,
    planId: string,
    planItemId: string,
  ): Promise<ExecutionEligibility | null> {
    const { data: donation, error: donationError } = await supabase
      .from('donations')
      .select('id,organization_id,amount,paid_at,paid_at_is_authoritative')
      .eq('id', donationId)
      .eq('organization_id', organizationId)
      .eq('status', 'paid')
      .maybeSingle();
    if (donationError) throw databaseError(donationError.message);
    if (!donation) return null;

    const { data: plan, error: planError } = await supabase
      .from('expenditure_plans')
      .select('id,title,organization_id,donation_id,period_start,period_end')
      .eq('id', planId)
      .eq('organization_id', organizationId)
      .eq('donation_id', donationId)
      .eq('status', 'registered')
      .maybeSingle();
    if (planError) throw databaseError(planError.message);
    if (!plan || !plan.period_start || !plan.period_end) return null;

    const { data: item, error: itemError } = await supabase
      .from('expenditure_plan_items')
      .select('id,name,amount')
      .eq('id', planItemId)
      .eq('plan_id', planId)
      .maybeSingle();
    if (itemError) throw databaseError(itemError.message);
    if (!item) return null;

    const { data: spentRows, error: spentError } = await supabase
      .from('expenditure_executions')
      .select('total_amount')
      .eq('plan_item_id', planItemId)
      .eq('status', 'registered');
    if (spentError) throw databaseError(spentError.message);
    const spent = (spentRows ?? []).reduce(
      (sum, row) => sum + Number(row.total_amount ?? 0),
      0,
    );

    return {
      organizationId,
      donationId,
      planId,
      planTitle: (plan.title as string | null) || '이름 없는 집행 계획',
      planItemId,
      planItemName: item.name as string,
      planPeriodStart: plan.period_start as string,
      planPeriodEnd: plan.period_end as string,
      donationPaidAt: donation.paid_at_is_authoritative
        ? ((donation.paid_at as string | null) ?? null)
        : null,
      planItemAmount: Number(item.amount),
      remainingBudget: Math.max(0, Number(item.amount) - spent),
    };
  }

  return {
    getEligibility: eligibilityFromIds,

    async listEligible() {
      const { data: plans, error } = await supabase
        .from('expenditure_plans')
        .select('id,title,organization_id,donation_id,period_start,period_end')
        .eq('status', 'registered')
        .order('updated_at', { ascending: false });
      if (error) throw databaseError(error.message);
      const options: EligibleExecutionOption[] = [];
      for (const plan of plans ?? []) {
        const { data: donation, error: donationError } = await supabase
          .from('donations')
          .select('amount')
          .eq('id', plan.donation_id)
          .eq('status', 'paid')
          .maybeSingle();
        if (donationError) throw databaseError(donationError.message);
        if (!donation) continue;
        const { data: items, error: itemError } = await supabase
          .from('expenditure_plan_items')
          .select('id')
          .eq('plan_id', plan.id)
          .order('sort_order');
        if (itemError) throw databaseError(itemError.message);
        for (const item of items ?? []) {
          const eligible = await eligibilityFromIds(
            plan.organization_id as string,
            plan.donation_id as string,
            plan.id as string,
            item.id as string,
          );
          if (eligible && eligible.remainingBudget > 0) {
            options.push({
              ...eligible,
              donationAmount: Number(donation.amount),
            });
          }
        }
      }
      return options;
    },

    async createAnalyzingExecution(input) {
      const { client, actorUserId } = mutationClient();
      const { data, error } = await client
        .rpc('create_expenditure_execution_analysis', {
          p_actor_id: actorUserId,
          p_organization_id: input.organizationId,
          p_donation_id: input.donationId,
          p_plan_id: input.planId,
          p_plan_item_id: input.planItemId,
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
          throw new ExecutionIdempotencyConflictError();
        }
        if (
          error?.message.includes(
            'execution_receipts_organization_id_source_fingerprint_key',
          ) ||
          error?.code === '23505'
        ) {
          throw new ExecutionDuplicateError(
            '동일한 원본 영수증이 이미 있습니다.',
          );
        }
        throw databaseError(error?.message ?? '집행 분석을 만들 수 없습니다.');
      }
      const row = data as Record<string, unknown>;
      return {
        id: row.execution_id as string,
        status: row.execution_status as ExecutionStatus,
        draft: parseReceiptDraft(row.execution_draft),
        issues: asArray<ReceiptValidationIssue>(
          row.execution_validation_issues,
        ),
        verificationResults: asArray<ReceiptVerificationResult>(
          row.execution_verification_results,
        ),
        sourcePath:
          typeof row.execution_source_path === 'string'
            ? row.execution_source_path
            : null,
        leaseToken:
          typeof row.lease_token === 'string' ? row.lease_token : null,
        shouldProcess: Boolean(row.should_process),
      };
    },

    async downloadPendingSource(sourcePath, fileName, mimeType) {
      const { client } = mutationClient();
      const { data, error } = await client.storage
        .from(RECEIPT_DOCUMENT_BUCKET)
        .download(sourcePath);
      if (error || !data) {
        throw databaseError(
          error?.message ?? '업로드 원본을 읽을 수 없습니다.',
        );
      }
      return new File([data], fileName, { type: mimeType });
    },

    async promoteSource(
      executionId,
      organizationId,
      pendingSourcePath,
      file,
      existingSourcePath,
    ) {
      const { client } = mutationClient();
      if (existingSourcePath) {
        await client.storage
          .from(RECEIPT_DOCUMENT_BUCKET)
          .remove([pendingSourcePath]);
        return existingSourcePath;
      }
      const finalPath = `${organizationId}/${executionId}/source.${extensionFor(file.type)}`;
      const { error } = await client.storage
        .from(RECEIPT_DOCUMENT_BUCKET)
        .move(pendingSourcePath, finalPath);
      if (error) {
        const { data: finalExists } = await client.storage
          .from(RECEIPT_DOCUMENT_BUCKET)
          .exists(finalPath);
        if (!finalExists) throw databaseError(error.message);
        const { error: cleanupError } = await client.storage
          .from(RECEIPT_DOCUMENT_BUCKET)
          .remove([pendingSourcePath]);
        if (cleanupError) throw databaseError(cleanupError.message);
      }
      return finalPath;
    },

    async removeSource(sourcePath) {
      const client = mutationContext?.client ?? supabase;
      const { error } = await client.storage
        .from(RECEIPT_DOCUMENT_BUCKET)
        .remove([sourcePath]);
      if (error) throw databaseError(error.message);
    },

    async markSourceUploaded(executionId, sourcePath, leaseToken) {
      const { client, actorUserId } = mutationClient();
      const { error } = await client.rpc('mark_execution_source_uploaded', {
        p_actor_id: actorUserId,
        p_execution_id: executionId,
        p_source_path: sourcePath,
        p_lease_token: leaseToken,
      });
      if (error) throw databaseError(error.message);
    },

    async saveAnalysis(
      executionId,
      leaseToken,
      sourcePath,
      parsed,
      verificationResults,
      semanticKey,
    ) {
      const { client, actorUserId } = mutationClient();
      const { data, error } = await client.rpc(
        'save_expenditure_execution_analysis',
        {
          p_actor_id: actorUserId,
          p_execution_id: executionId,
          p_lease_token: leaseToken,
          p_source_path: sourcePath,
          p_draft: parsed.draft,
          p_validation_issues: parsed.issues,
          p_ocr_metadata: parsed.metadata,
          p_verification_results: verificationResults,
          p_semantic_key: semanticKey,
        },
      );
      if (error) {
        if (error.code === '23505') throw new ExecutionDuplicateError();
        throw databaseError(error.message);
      }
      return data as ExecutionStatus;
    },

    async saveFailure(executionId, leaseToken, errorCode, sourcePath) {
      const { client, actorUserId } = mutationClient();
      const { error } = await client.rpc('mark_expenditure_execution_failed', {
        p_actor_id: actorUserId,
        p_execution_id: executionId,
        p_lease_token: leaseToken,
        p_error_code: errorCode,
        p_source_path: sourcePath ?? null,
      });
      if (error) throw databaseError(error.message);
    },

    async verificationContext(
      eligibility,
      sourceFingerprint,
      semanticKey,
      excludeExecutionId,
    ) {
      const client = mutationContext?.client ?? supabase;
      const { data: duplicateReceipt, error: receiptError } = await client
        .from('execution_receipts')
        .select('execution_id')
        .eq('organization_id', eligibility.organizationId)
        .eq('source_fingerprint', sourceFingerprint)
        .neq('execution_id', excludeExecutionId)
        .maybeSingle();
      if (receiptError) throw databaseError(receiptError.message);
      let duplicateTransaction = false;
      if (semanticKey) {
        const { data, error } = await client
          .from('expenditure_executions')
          .select('id')
          .eq('organization_id', eligibility.organizationId)
          .eq('semantic_key', semanticKey)
          .neq('id', excludeExecutionId)
          .maybeSingle();
        if (error) throw databaseError(error.message);
        duplicateTransaction = Boolean(data);
      }
      const refreshed = await eligibilityFromIds(
        eligibility.organizationId,
        eligibility.donationId,
        eligibility.planId,
        eligibility.planItemId,
      );
      if (!refreshed)
        throw databaseError('집행 참조를 다시 확인할 수 없습니다.');
      return {
        planPeriodStart: refreshed.planPeriodStart,
        planPeriodEnd: refreshed.planPeriodEnd,
        donationPaidAt: refreshed.donationPaidAt,
        remainingBudget: refreshed.remainingBudget,
        duplicateSource: Boolean(duplicateReceipt),
        duplicateTransaction,
        sourceFingerprint,
      };
    },

    async getReview(executionId) {
      const { data: execution, error } = await supabase
        .from('expenditure_executions')
        .select(
          'id,organization_id,donation_id,plan_id,plan_item_id,status,draft_data,validation_issues,verification_results,warning_reason',
        )
        .eq('id', executionId)
        .maybeSingle();
      if (error) throw databaseError(error.message);
      if (!execution) return null;
      const draft = parseReceiptDraft(execution.draft_data);
      if (!draft) return null;
      const { data: receipt, error: receiptError } = await supabase
        .from('execution_receipts')
        .select(
          'source_path,source_file_name,source_mime_type,source_fingerprint',
        )
        .eq('execution_id', executionId)
        .maybeSingle();
      if (receiptError) throw databaseError(receiptError.message);
      if (!receipt?.source_path) return null;
      const eligibility = await eligibilityFromIds(
        execution.organization_id as string,
        execution.donation_id as string,
        execution.plan_id as string,
        execution.plan_item_id as string,
      );
      if (!eligibility) return null;
      const { data: signed, error: signedError } = await supabase.storage
        .from(RECEIPT_DOCUMENT_BUCKET)
        .createSignedUrl(receipt.source_path as string, 300);
      if (signedError || !signed)
        throw databaseError(signedError?.message ?? '원본 URL 오류');
      const { data: run } = await supabase
        .from('receipt_ocr_runs')
        .select('api_version,model_version,page_count,processed_at')
        .eq('execution_id', executionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        id: execution.id as string,
        organizationId: execution.organization_id as string,
        donationId: execution.donation_id as string,
        planId: execution.plan_id as string,
        planItemId: execution.plan_item_id as string,
        planItemName: eligibility.planItemName,
        status: execution.status as ExecutionStatus,
        draft,
        issues: asArray<ReceiptValidationIssue>(execution.validation_issues),
        verificationResults: asArray<ReceiptVerificationResult>(
          execution.verification_results,
        ),
        warningReason: (execution.warning_reason as string) || '',
        remainingBudget: eligibility.remainingBudget,
        sourceFileName: receipt.source_file_name as string,
        sourceMimeType: receipt.source_mime_type as string,
        sourceUrl: signed.signedUrl,
        sourceFingerprint: receipt.source_fingerprint as string,
        ocrMetadata: {
          provider: 'upstage',
          apiVersion: (run?.api_version as string) || '',
          modelVersion: (run?.model_version as string) || '',
          pageCount: Number(run?.page_count ?? 0),
          processedAt: (run?.processed_at as string) || '',
        },
      };
    },

    async register(
      executionId,
      planItemId,
      draft,
      verificationResults,
      warningReason,
    ) {
      const { client, actorUserId } = mutationClient();
      const { error } = await client.rpc('register_expenditure_execution', {
        p_actor_id: actorUserId,
        p_execution_id: executionId,
        p_plan_item_id: planItemId,
        p_draft: draft,
        p_verification_results: verificationResults,
        p_warning_reason: warningReason,
      });
      if (error) {
        if (error.message.includes('duplicate') || error.code === '23505') {
          throw new ExecutionDuplicateError();
        }
        throw databaseError(error.message);
      }
    },

    async list() {
      const { data, error } = await supabase
        .from('expenditure_executions')
        .select(
          'id,merchant_name,status,total_amount,transaction_at,plan_item_id,updated_at,analysis_lease_expires_at',
        )
        .order('updated_at', { ascending: false });
      if (error) throw databaseError(error.message);
      const items: ExecutionListItem[] = [];
      const listedAt = Date.now();
      for (const execution of data ?? []) {
        const { data: planItem } = await supabase
          .from('expenditure_plan_items')
          .select('name')
          .eq('id', execution.plan_item_id)
          .maybeSingle();
        const leaseExpiresAt =
          (execution.analysis_lease_expires_at as string | null) ?? null;
        items.push({
          id: execution.id as string,
          merchantName:
            (execution.merchant_name as string | null) || '분석 중인 영수증',
          status: execution.status as ExecutionStatus,
          totalAmount: execution.total_amount as number | null,
          transactionAt: execution.transaction_at as string | null,
          planItemName: (planItem?.name as string | null) || '-',
          updatedAt: execution.updated_at as string,
          analysisLeaseExpiresAt: leaseExpiresAt,
          retryAvailable:
            execution.status === 'analysis_failed' ||
            (execution.status === 'analyzing' &&
              (!leaseExpiresAt ||
                new Date(leaseExpiresAt).getTime() <= listedAt)),
        });
      }
      return items;
    },

    async claimRetry(executionId) {
      const { client, actorUserId } = mutationClient();
      const { data, error } = await client
        .rpc('claim_execution_analysis_retry', {
          p_actor_id: actorUserId,
          p_execution_id: executionId,
        })
        .maybeSingle();
      if (error) throw databaseError(error.message);
      if (!data) return null;
      const source = data as Record<string, unknown>;
      if (
        typeof source.source_path !== 'string' ||
        typeof source.lease_token !== 'string'
      ) {
        throw databaseError('분석 재시도 소유권을 확인할 수 없습니다.');
      }
      return {
        executionId: source.execution_id as string,
        organizationId: source.organization_id as string,
        donationId: source.donation_id as string,
        planId: source.plan_id as string,
        planItemId: source.plan_item_id as string,
        sourcePath: source.source_path,
        fileName: source.source_file_name as string,
        mimeType: source.source_mime_type as string,
        fingerprint: source.source_fingerprint as string,
        leaseToken: source.lease_token,
      };
    },

    async downloadSource(source) {
      const { client } = mutationClient();
      const { data, error } = await client.storage
        .from(RECEIPT_DOCUMENT_BUCKET)
        .download(source.sourcePath);
      if (error || !data)
        throw databaseError(error?.message ?? '원본 다운로드 실패');
      return new File([data], source.fileName, { type: source.mimeType });
    },
  };
}
