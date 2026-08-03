import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  OrganizationAiContext,
  PledgeConsultationResult,
} from './ai-schema';
import {
  toOrganizationAiContext,
  toPledgeAiContext,
} from './consultation-context';
import type { ConsultationMessage } from './consultation-prompt';

export type StoredConsultationContext = {
  pledgeId: string;
  organization: OrganizationAiContext;
  currentPledge: ReturnType<typeof toPledgeAiContext>;
  version: number;
  status: string;
  messages: ConsultationMessage[];
};

export type StoredUserMessage = {
  id: string;
  pledgeId: string;
  requestId: string;
  content: string;
  status: 'pending' | 'completed' | 'failed';
  failureCode?: string | null;
  failureRetryable?: boolean | null;
  updatedAt?: string;
};

export type StoredConsultationTurn = {
  message: StoredUserMessage;
  assistantMessage: { id: string; content: string } | null;
  proposal: Record<string, unknown> | null;
};

export class ConsultationRepositoryError extends Error {
  constructor(
    public readonly code:
      | 'not_found'
      | 'not_editable'
      | 'lookup_failed'
      | 'save_failed'
      | 'in_progress'
      | 'turn_unavailable',
    message = '상담 저장소를 처리할 수 없습니다.',
  ) {
    super(message);
    this.name = 'ConsultationRepositoryError';
  }
}

const PLEDGE_SELECT =
  'id, organization_id, status, version, amount, donation_designation, donation_condition, payment_schedule, payment_schedule_other, payment_method, payment_method_other, organizations(id, name, description)';

export async function getStoredConsultationContext(
  supabase: SupabaseClient,
  pledgeId: string,
  userId: string,
  options: { requireEditable?: boolean } = {},
): Promise<StoredConsultationContext> {
  const { data: pledge, error } = await supabase
    .from('pledges')
    .select(PLEDGE_SELECT)
    .eq('id', pledgeId)
    .eq('donor_user_id', userId)
    .maybeSingle();
  if (error) throw new ConsultationRepositoryError('lookup_failed');
  if (!pledge) throw new ConsultationRepositoryError('not_found');
  if (options.requireEditable !== false && pledge.status !== 'draft')
    throw new ConsultationRepositoryError('not_editable');

  const organizationRecord = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]
    : pledge.organizations;
  const organizationFields = (organizationRecord ?? {}) as Record<
    string,
    unknown
  >;
  const { data: designatedPrograms, error: programError } = await supabase
    .from('organization_programs')
    .select(
      'id, name, description, organization_program_conditions(condition_text)',
    )
    .eq('organization_id', pledge.organization_id)
    .eq('review_status', 'approved')
    .eq('accepting_designated_donations', true)
    .eq('organization_program_conditions.condition_type', 'allowed')
    .eq('organization_program_conditions.review_status', 'approved');
  if (programError) throw new ConsultationRepositoryError('lookup_failed');
  const programDescriptions = (designatedPrograms ?? []).map((program) => {
    const conditions = Array.isArray(program.organization_program_conditions)
      ? program.organization_program_conditions
          .map((condition) =>
            typeof condition === 'object' &&
            condition !== null &&
            'condition_text' in condition
              ? String(condition.condition_text)
              : null,
          )
          .filter((condition): condition is string => Boolean(condition))
      : [];
    return `${program.name}: ${program.description}${conditions.length ? ` (지정 기부 예시: ${conditions.join(', ')})` : ''}`;
  });
  const programs = (designatedPrograms ?? []).map((program) => ({
    id: String(program.id),
    key: String(program.id),
    name: String(program.name),
    description: String(program.description ?? ''),
    allowedConditions: Array.isArray(program.organization_program_conditions)
      ? program.organization_program_conditions
          .map((condition) =>
            typeof condition === 'object' &&
            condition !== null &&
            'condition_text' in condition
              ? String(condition.condition_text)
              : null,
          )
          .filter((condition): condition is string => Boolean(condition))
      : [],
  }));
  const organization = toOrganizationAiContext({
    ...organizationFields,
    activityAreas: Array.isArray(organizationFields.activityAreas)
      ? organizationFields.activityAreas
      : [],
    supportedPrograms: programDescriptions.length
      ? programDescriptions
      : Array.isArray(organizationFields.supportedPrograms)
        ? organizationFields.supportedPrograms
        : [],
    programs,
    donationPolicy: programDescriptions.length
      ? '지정 기부는 승인된 사업의 허용 조건 안에서만 작성할 수 있습니다.'
      : typeof organizationFields.donationPolicy === 'string'
        ? organizationFields.donationPolicy
        : null,
  });
  if (!organization) throw new ConsultationRepositoryError('lookup_failed');

  const { data: messages, error: messageError } = await supabase
    .from('pledge_chat_messages')
    .select('role, content, status, created_at')
    .eq('pledge_id', pledgeId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });
  if (messageError) throw new ConsultationRepositoryError('lookup_failed');

  return {
    pledgeId,
    organization,
    currentPledge: toPledgeAiContext(pledge as Record<string, unknown>),
    version: typeof pledge.version === 'number' ? pledge.version : 1,
    status: pledge.status,
    messages: (messages ?? [])
      .filter(
        (message) =>
          (message.role === 'user' || message.role === 'assistant') &&
          typeof message.content === 'string',
      )
      .slice(-20)
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content as string,
      })),
  };
}

export async function findConsultationTurn(
  supabase: SupabaseClient,
  pledgeId: string,
  requestId: string,
): Promise<StoredUserMessage | null> {
  const { data, error } = await supabase
    .from('pledge_chat_messages')
    .select(
      'id, pledge_id, client_request_id, content, status, failure_code, failure_retryable, updated_at',
    )
    .eq('pledge_id', pledgeId)
    .eq('client_request_id', requestId)
    .eq('role', 'user')
    .maybeSingle();
  if (error) throw new ConsultationRepositoryError('lookup_failed');
  if (!data) return null;
  return {
    id: data.id,
    pledgeId: data.pledge_id,
    requestId: data.client_request_id,
    content: data.content,
    status: data.status,
    failureCode: data.failure_code,
    failureRetryable: data.failure_retryable,
    updatedAt: data.updated_at,
  };
}

export async function createPendingUserMessage(
  supabase: SupabaseClient,
  input: { pledgeId: string; requestId: string; content: string },
): Promise<StoredUserMessage> {
  const { data, error } = await supabase
    .from('pledge_chat_messages')
    .insert({
      pledge_id: input.pledgeId,
      client_request_id: input.requestId,
      content: input.content,
      role: 'user',
      status: 'pending',
    })
    .select(
      'id, pledge_id, client_request_id, content, status, failure_code, failure_retryable, updated_at',
    )
    .single();
  if (error) {
    if (error.code === '23505')
      throw new ConsultationRepositoryError('in_progress');
    throw new ConsultationRepositoryError('save_failed');
  }
  return {
    id: data.id,
    pledgeId: data.pledge_id,
    requestId: data.client_request_id,
    content: data.content,
    status: data.status,
    failureCode: data.failure_code,
    failureRetryable: data.failure_retryable,
    updatedAt: data.updated_at,
  };
}

export async function recoverStaleConsultationMessage(
  supabase: SupabaseClient,
  messageId: string,
  staleBefore: string,
): Promise<StoredUserMessage> {
  const { data, error } = await supabase.rpc(
    'recover_stale_pledge_ai_consultation',
    { p_user_message_id: messageId, p_stale_before: staleBefore },
  );
  if (error) {
    if (error.message.includes('consultation_turn_not_available'))
      throw new ConsultationRepositoryError('in_progress');
    throw new ConsultationRepositoryError('save_failed');
  }
  if (!data) throw new ConsultationRepositoryError('in_progress');
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new ConsultationRepositoryError('in_progress');
  return {
    id: row.id,
    pledgeId: row.pledge_id,
    requestId: row.client_request_id,
    content: row.content,
    status: row.status,
    failureCode: row.failure_code,
    failureRetryable: row.failure_retryable,
    updatedAt: row.updated_at,
  };
}

export async function getConsultationTurn(
  supabase: SupabaseClient,
  message: StoredUserMessage,
): Promise<StoredConsultationTurn> {
  const { data: assistant, error: assistantError } = await supabase
    .from('pledge_chat_messages')
    .select('id, content')
    .eq('reply_to_message_id', message.id)
    .maybeSingle();
  if (assistantError) throw new ConsultationRepositoryError('lookup_failed');
  if (!assistant) return { message, assistantMessage: null, proposal: null };
  const { data: proposal, error: proposalError } = await supabase
    .from('pledge_ai_proposals')
    .select(
      'id, proposed_patch, status, confirmation_fields, conflict_fields, missing_fields, next_question_field, pledge_version',
    )
    .eq('assistant_message_id', assistant.id)
    .maybeSingle();
  if (proposalError) throw new ConsultationRepositoryError('lookup_failed');
  return {
    message,
    assistantMessage: { id: assistant.id, content: assistant.content },
    proposal: proposal as Record<string, unknown> | null,
  };
}

export async function markConsultationFailed(
  supabase: SupabaseClient,
  messageId: string,
  code: string,
  retryable: boolean,
) {
  const { error } = await supabase.rpc('fail_pledge_ai_consultation', {
    p_user_message_id: messageId,
    p_failure_code: code,
    p_failure_retryable: retryable,
  });
  if (error) throw new ConsultationRepositoryError('save_failed');
}

export async function completeConsultationTurn(
  supabase: SupabaseClient,
  input: {
    messageId: string;
    pledgeVersion: number;
    result: PledgeConsultationResult;
    metadata: {
      requestId: string | null;
      attempts: number;
      durationMs: number;
      usage: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      } | null;
    };
    model: string;
  },
) {
  const { data, error } = await supabase.rpc(
    'complete_pledge_ai_consultation',
    {
      p_user_message_id: input.messageId,
      p_assistant_content: input.result.assistantMessage,
      p_proposed_patch: input.result.proposedPatch,
      p_confirmation_fields: input.result.confirmationFields,
      p_conflict_fields: input.result.conflictFields,
      p_missing_fields: input.result.missingFields,
      p_next_question_field: input.result.nextQuestionField,
      p_pledge_version: input.pledgeVersion,
      p_model: input.model,
      p_provider_request_id: input.metadata.requestId,
      p_attempt_count: input.metadata.attempts,
      p_duration_ms: input.metadata.durationMs,
      p_prompt_tokens: input.metadata.usage?.promptTokens ?? null,
      p_completion_tokens: input.metadata.usage?.completionTokens ?? null,
      p_total_tokens: input.metadata.usage?.totalTokens ?? null,
      p_prompt_version: 'pledge-consultation-v1',
    },
  );
  if (error) {
    if (error.message.includes('consultation_turn_not_available'))
      throw new ConsultationRepositoryError('turn_unavailable');
    throw new ConsultationRepositoryError('save_failed');
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    assistantMessageId: row?.assistant_message_id ?? null,
    proposalId: row?.proposal_id ?? null,
  };
}
