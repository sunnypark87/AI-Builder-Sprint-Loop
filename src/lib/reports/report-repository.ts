import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildReportEvidence,
  parseReportEvidence,
  type RawReportEvidence,
} from './report-evidence';
import { parseReportContent } from './report-schema';
import type {
  EligibleReportDonation,
  ReportContent,
  ReportEvidence,
  ReportListItem,
  ReportReview,
  ReportStatus,
  ReportValidationIssue,
  SolarReportMetadata,
} from './types';

export class ReportRepositoryError extends Error {
  constructor(
    public readonly code:
      | 'database_error'
      | 'not_found'
      | 'forbidden'
      | 'invalid_evidence'
      | 'conflict',
    message: string,
  ) {
    super(message);
    this.name = 'ReportRepositoryError';
  }
}

type MutationContext = { actorUserId: string; client: SupabaseClient };

function databaseError(message = '보고서 저장소 오류') {
  return new ReportRepositoryError('database_error', message);
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asIssues(value: unknown): ReportValidationIssue[] {
  return Array.isArray(value) ? (value as ReportValidationIssue[]) : [];
}

export type BeginReportGeneration = {
  id: string;
  status: ReportStatus;
  evidence: ReportEvidence;
  leaseToken: string | null;
  shouldGenerate: boolean;
};

export interface ReportRepository {
  listEligible(): Promise<EligibleReportDonation[]>;
  list(): Promise<ReportListItem[]>;
  buildEvidence(donationId: string, planId: string): Promise<ReportEvidence>;
  begin(input: {
    evidence: ReportEvidence;
    title: string;
    idempotencyKey: string;
  }): Promise<BeginReportGeneration>;
  saveGeneration(
    reportId: string,
    leaseToken: string,
    content: ReportContent,
    metadata: SolarReportMetadata,
  ): Promise<void>;
  markGenerationFailed(
    reportId: string,
    leaseToken: string,
    errorCode: string,
  ): Promise<void>;
  claimRetry(reportId: string): Promise<{
    evidence: ReportEvidence;
    leaseToken: string;
  } | null>;
  getReview(reportId: string): Promise<ReportReview | null>;
  saveDraft(
    reportId: string,
    content: ReportContent,
    issues: ReportValidationIssue[],
  ): Promise<void>;
  publish(reportId: string, content: ReportContent): Promise<string>;
}

export function createReportRepository(
  readClient: SupabaseClient,
  mutation?: MutationContext,
): ReportRepository {
  const mutationClient = () => {
    if (!mutation) {
      throw new ReportRepositoryError(
        'forbidden',
        '보고서를 변경할 권한이 없습니다.',
      );
    }
    return mutation.client;
  };
  const actor = () => {
    if (!mutation) {
      throw new ReportRepositoryError(
        'forbidden',
        '보고서를 변경할 권한이 없습니다.',
      );
    }
    return mutation.actorUserId;
  };

  async function organizationIds() {
    const client = mutation?.client ?? readClient;
    const userId = mutation?.actorUserId;
    if (!userId) {
      const { data: userData, error: userError } =
        await readClient.auth.getUser();
      if (userError || !userData.user) return [];
      const { data, error } = await client
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userData.user.id);
      if (error) throw databaseError();
      return (data ?? []).map((row) => row.organization_id as string);
    }
    const { data, error } = await client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId);
    if (error) throw databaseError();
    return (data ?? []).map((row) => row.organization_id as string);
  }

  async function ensureMember(organizationId: string) {
    if (!mutation) return;
    const { data, error } = await mutation.client
      .from('organization_members')
      .select('organization_id')
      .eq('organization_id', organizationId)
      .eq('user_id', mutation.actorUserId)
      .maybeSingle();
    if (error) throw databaseError();
    if (!data) {
      throw new ReportRepositoryError(
        'not_found',
        '보고서를 찾을 수 없습니다.',
      );
    }
  }

  return {
    async listEligible() {
      const client = mutation?.client ?? readClient;
      const organizations = await organizationIds();
      if (organizations.length === 0) return [];
      const [{ data: organizationRows, error: organizationError }, donations] =
        await Promise.all([
          client
            .from('organizations')
            .select('id,name')
            .in('id', organizations),
          client
            .from('donations')
            .select('id,organization_id,pledge_id')
            .in('organization_id', organizations)
            .eq('status', 'paid')
            .not('pledge_id', 'is', null),
        ]);
      if (organizationError || donations.error) throw databaseError();
      const donationRows = donations.data ?? [];
      if (donationRows.length === 0) return [];
      const pledgeIds = donationRows.map((row) => row.pledge_id as string);
      const donationIds = donationRows.map((row) => row.id as string);
      const [
        { data: pledges, error: pledgeError },
        { data: plans, error: planError },
      ] = await Promise.all([
        client
          .from('pledges')
          .select('id,organization_id,purpose,status')
          .in('id', pledgeIds)
          .eq('status', 'signed'),
        client
          .from('expenditure_plans')
          .select(
            'id,organization_id,donation_id,title,period_start,period_end',
          )
          .in('donation_id', donationIds)
          .eq('status', 'registered'),
      ]);
      if (pledgeError || planError) throw databaseError();
      const planRows = plans ?? [];
      if (planRows.length === 0) return [];
      const { data: executions, error: executionError } = await client
        .from('expenditure_executions')
        .select('id,plan_id,donation_id')
        .in(
          'plan_id',
          planRows.map((row) => row.id as string),
        )
        .eq('status', 'registered');
      if (executionError) throw databaseError();
      const organizationName = new Map(
        (organizationRows ?? []).map((row) => [
          row.id as string,
          row.name as string,
        ]),
      );
      const pledgeById = new Map(
        (pledges ?? []).map((row) => [row.id as string, row]),
      );
      const donationById = new Map(
        donationRows.map((row) => [row.id as string, row]),
      );
      const executionCountByPlan = new Map<string, number>();
      for (const execution of executions ?? []) {
        const planId = execution.plan_id as string;
        executionCountByPlan.set(
          planId,
          (executionCountByPlan.get(planId) ?? 0) + 1,
        );
      }
      return planRows.flatMap((plan): EligibleReportDonation[] => {
        const donation = donationById.get(plan.donation_id as string);
        if (!donation) return [];
        const pledge = pledgeById.get(donation.pledge_id as string);
        const count = executionCountByPlan.get(plan.id as string) ?? 0;
        if (!pledge || count === 0) return [];
        return [
          {
            organizationId: donation.organization_id as string,
            organizationName:
              organizationName.get(donation.organization_id as string) ??
              '기부처',
            donationId: donation.id as string,
            pledgeId: donation.pledge_id as string,
            planId: plan.id as string,
            planTitle: plan.title as string,
            purpose: pledge.purpose as string,
            periodStart: plan.period_start as string,
            periodEnd: plan.period_end as string,
            executionCount: count,
          },
        ];
      });
    },

    async list() {
      const organizations = await organizationIds();
      if (organizations.length === 0) return [];
      const { data, error } = await readClient
        .from('donation_reports')
        .select(
          'id,title,status,period_start,period_end,updated_at,generation_lease_expires_at',
        )
        .in('organization_id', organizations)
        .order('updated_at', { ascending: false });
      if (error) throw databaseError();
      const now = Date.now();
      return (data ?? []).map((row): ReportListItem => {
        const status = row.status as ReportStatus;
        const lease = row.generation_lease_expires_at as string | null;
        return {
          id: row.id as string,
          title: row.title as string,
          status,
          periodStart: row.period_start as string,
          periodEnd: row.period_end as string,
          updatedAt: row.updated_at as string,
          generationLeaseExpiresAt: lease,
          retryAvailable:
            status === 'generation_failed' ||
            (status === 'generating' &&
              (!lease || new Date(lease).getTime() <= now)),
        };
      });
    },

    async buildEvidence(donationId, planId) {
      const client = mutationClient();
      const { data: donation, error: donationError } = await client
        .from('donations')
        .select('id,organization_id,pledge_id,status')
        .eq('id', donationId)
        .eq('status', 'paid')
        .maybeSingle();
      if (donationError) throw databaseError();
      if (!donation?.pledge_id) {
        throw new ReportRepositoryError(
          'not_found',
          '보고 대상 기부를 찾을 수 없습니다.',
        );
      }
      await ensureMember(donation.organization_id as string);
      const [
        { data: pledge, error: pledgeError },
        { data: plan, error: planError },
      ] = await Promise.all([
        client
          .from('pledges')
          .select('id,organization_id,status,purpose,donation_condition')
          .eq('id', donation.pledge_id)
          .eq('organization_id', donation.organization_id)
          .eq('status', 'signed')
          .maybeSingle(),
        client
          .from('expenditure_plans')
          .select(
            'id,organization_id,donation_id,title,period_start,period_end,total_amount',
          )
          .eq('id', planId)
          .eq('donation_id', donationId)
          .eq('organization_id', donation.organization_id)
          .eq('status', 'registered')
          .maybeSingle(),
      ]);
      if (pledgeError || planError) throw databaseError();
      if (!pledge || !plan) {
        throw new ReportRepositoryError(
          'not_found',
          '보고 대상 근거를 찾을 수 없습니다.',
        );
      }
      const [
        { data: items, error: itemError },
        { data: executions, error: executionError },
      ] = await Promise.all([
        client
          .from('expenditure_plan_items')
          .select('id,name,description,amount,sort_order')
          .eq('plan_id', planId)
          .order('sort_order', { ascending: true }),
        client
          .from('expenditure_executions')
          .select('id,plan_item_id,merchant_name,transaction_at,total_amount')
          .eq('plan_id', planId)
          .eq('donation_id', donationId)
          .eq('organization_id', donation.organization_id)
          .eq('status', 'registered')
          .order('transaction_at', { ascending: true }),
      ]);
      if (itemError || executionError) throw databaseError();
      const source: RawReportEvidence = {
        organizationId: donation.organization_id as string,
        donationId,
        pledgeId: pledge.id as string,
        purpose: (pledge.purpose as string) ?? '',
        donationCondition: (pledge.donation_condition as string | null) ?? '',
        plan: {
          id: plan.id as string,
          title: plan.title as string,
          periodStart: plan.period_start as string,
          periodEnd: plan.period_end as string,
          totalAmount: Number(plan.total_amount),
          items: (items ?? []).map((item) => ({
            id: item.id as string,
            name: item.name as string,
            description: (item.description as string | null) ?? '',
            amount: Number(item.amount),
          })),
        },
        executions: (executions ?? []).map((execution) => ({
          id: execution.id as string,
          planItemId: execution.plan_item_id as string,
          merchantName: (execution.merchant_name as string | null) ?? '집행처',
          transactionDate: String(execution.transaction_at).slice(0, 10),
          totalAmount: Number(execution.total_amount),
        })),
      };
      return buildReportEvidence(source);
    },

    async begin(input) {
      const client = mutationClient();
      const { data, error } = await client.rpc(
        'create_donation_report_generation',
        {
          p_actor_id: actor(),
          p_organization_id: input.evidence.organizationId,
          p_donation_id: input.evidence.donationId,
          p_pledge_id: input.evidence.pledgeId,
          p_plan_id: input.evidence.plan.id,
          p_title: input.title,
          p_period_start: input.evidence.plan.periodStart,
          p_period_end: input.evidence.plan.periodEnd,
          p_idempotency_key: input.idempotencyKey,
          p_evidence_snapshot: input.evidence,
        },
      );
      if (error) {
        const code = /idempotency|unique|duplicate/i.test(error.message)
          ? 'conflict'
          : 'database_error';
        throw new ReportRepositoryError(code, error.message);
      }
      const row = first(data as Record<string, unknown>[] | null);
      const evidence = parseReportEvidence(row?.evidence_snapshot);
      if (!row || !evidence) throw databaseError();
      return {
        id: row.report_id as string,
        status: row.report_status as ReportStatus,
        evidence,
        leaseToken: (row.lease_token as string | null) ?? null,
        shouldGenerate: row.should_generate === true,
      };
    },

    async saveGeneration(reportId, leaseToken, content, metadata) {
      const { error } = await mutationClient().rpc(
        'save_donation_report_generation',
        {
          p_actor_id: actor(),
          p_report_id: reportId,
          p_lease_token: leaseToken,
          p_ai_draft: content,
          p_validation_issues: [],
          p_model_metadata: metadata,
        },
      );
      if (error) throw databaseError(error.message);
    },

    async markGenerationFailed(reportId, leaseToken, errorCode) {
      const { error } = await mutationClient().rpc(
        'mark_donation_report_generation_failed',
        {
          p_actor_id: actor(),
          p_report_id: reportId,
          p_lease_token: leaseToken,
          p_error_code: errorCode,
        },
      );
      if (error) throw databaseError(error.message);
    },

    async claimRetry(reportId) {
      const { data, error } = await mutationClient().rpc(
        'claim_donation_report_retry',
        {
          p_actor_id: actor(),
          p_report_id: reportId,
        },
      );
      if (error) throw databaseError(error.message);
      const row = first(data as Record<string, unknown>[] | null);
      if (!row) return null;
      const evidence = parseReportEvidence(row.evidence_snapshot);
      if (!evidence || typeof row.lease_token !== 'string')
        throw databaseError();
      return { evidence, leaseToken: row.lease_token };
    },

    async getReview(reportId) {
      const client = mutation?.client ?? readClient;
      const { data, error } = await client
        .from('donation_reports')
        .select(
          'id,organization_id,status,title,evidence_snapshot,draft_content,validation_issues,generation_error_code,generation_lease_expires_at,published_at',
        )
        .eq('id', reportId)
        .maybeSingle();
      if (error) throw databaseError();
      if (!data) return null;
      await ensureMember(data.organization_id as string);
      const evidence = parseReportEvidence(data.evidence_snapshot);
      if (!evidence)
        throw new ReportRepositoryError(
          'invalid_evidence',
          '보고 근거가 손상됐습니다.',
        );
      const status = data.status as ReportStatus;
      const lease = data.generation_lease_expires_at as string | null;
      return {
        id: data.id as string,
        status,
        title: data.title as string,
        evidence,
        content: parseReportContent(data.draft_content),
        issues: asIssues(data.validation_issues),
        generationErrorCode:
          (data.generation_error_code as string | null) ?? '',
        retryAvailable:
          status === 'generation_failed' ||
          (status === 'generating' &&
            (!lease || new Date(lease).getTime() <= Date.now())),
        publishedAt: (data.published_at as string | null) ?? null,
      };
    },

    async saveDraft(reportId, content, issues) {
      const { error } = await mutationClient().rpc(
        'save_donation_report_draft',
        {
          p_actor_id: actor(),
          p_report_id: reportId,
          p_draft_content: content,
          p_validation_issues: issues,
        },
      );
      if (error) throw databaseError(error.message);
    },

    async publish(reportId, content) {
      const { data, error } = await mutationClient().rpc(
        'publish_donation_report',
        {
          p_actor_id: actor(),
          p_report_id: reportId,
          p_draft_content: content,
        },
      );
      if (error) {
        throw new ReportRepositoryError(
          /already|publishable/i.test(error.message)
            ? 'conflict'
            : 'database_error',
          error.message,
        );
      }
      if (typeof data !== 'string') throw databaseError();
      return data;
    },
  };
}
