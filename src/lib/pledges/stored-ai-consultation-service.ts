import {
  buildConsultationPrompt,
  type ConsultationMessage,
} from './consultation-prompt';
import {
  completeConsultationTurn,
  createPendingUserMessage,
  findConsultationTurn,
  getConsultationTurn,
  getStoredConsultationContext,
  markConsultationFailed,
  recoverStaleConsultationMessage,
  ConsultationRepositoryError,
  type StoredConsultationTurn,
} from './ai-consultation-repository';
import {
  consultPledge,
  type AiConsultationFailure,
} from './ai-consultation-service';
import type { UpstageChatConfig } from '@/lib/upstage/chat-config';
import type { SupabaseClient } from '@supabase/supabase-js';

export type StoredConsultationResult =
  | { ok: true; turn: StoredConsultationTurn }
  | {
      ok: false;
      code: string;
      retryable: boolean;
      kinds?: string[];
      reason?: string;
      status?: number;
    };

export async function runStoredPledgeConsultation(input: {
  supabase: SupabaseClient;
  userId: string;
  pledgeId: string;
  requestId: string;
  message: string;
  fetchImpl?: typeof fetch;
  config?: UpstageChatConfig;
}): Promise<StoredConsultationResult> {
  let context;
  try {
    context = await getStoredConsultationContext(
      input.supabase,
      input.pledgeId,
      input.userId,
    );
  } catch (error) {
    return mapRepositoryError(error);
  }

  let existing;
  try {
    existing = await findConsultationTurn(
      input.supabase,
      input.pledgeId,
      input.requestId,
    );
  } catch (error) {
    return mapRepositoryError(error);
  }
  if (existing) {
    if (normalizeMessage(existing.content) !== normalizeMessage(input.message))
      return {
        ok: false,
        code: 'idempotency_conflict',
        retryable: false,
        status: 409,
      };
    if (existing.status === 'pending')
      if (!isStale(existing.updatedAt))
        return {
          ok: false,
          code: 'consultation_in_progress',
          retryable: true,
          status: 409,
        };
    if (existing.status === 'completed')
      try {
        return {
          ok: true,
          turn: await getConsultationTurn(input.supabase, existing),
        };
      } catch (error) {
        return mapRepositoryError(error);
      }
    if (existing.status === 'failed' && !existing.failureRetryable)
      return {
        ok: false,
        code: existingFailureCode(existing),
        retryable: false,
        status: 502,
      };
  }

  const messages: ConsultationMessage[] = [
    ...context.messages.slice(-CONSULTATION_MAX_EXISTING_MESSAGES),
    { role: 'user', content: input.message },
  ];
  const safePrompt = buildConsultationPrompt(
    context.organization,
    context.currentPledge,
    messages,
  );
  if (!safePrompt.ok)
    return safePrompt.code === 'sensitive_input_detected'
      ? {
          ok: false,
          code: safePrompt.code,
          kinds: safePrompt.kinds,
          retryable: false,
          status: 400,
        }
      : {
          ok: false,
          code: safePrompt.code,
          reason: safePrompt.reason,
          retryable: false,
          status: 413,
        };

  let userMessage;
  try {
    userMessage =
      existing?.status === 'pending'
        ? await recoverStaleConsultationMessage(
            input.supabase,
            existing.id,
            new Date(Date.now() - PENDING_TIMEOUT_MS).toISOString(),
          )
        : existing?.status === 'failed'
          ? await reopenFailedMessage(input.supabase, existing.id)
          : await createPendingUserMessage(input.supabase, {
              pledgeId: input.pledgeId,
              requestId: input.requestId,
              content: input.message,
            });
  } catch (error) {
    if (
      error instanceof ConsultationRepositoryError &&
      error.code === 'in_progress'
    )
      return resolveConcurrentTurn(input, input.message);
    return mapRepositoryError(error);
  }

  const result = await consultPledge({
    organization: context.organization,
    currentPledge: context.currentPledge,
    messages,
    fetchImpl: input.fetchImpl,
    config: input.config,
  });
  if (!result.ok) {
    try {
      await markConsultationFailed(
        input.supabase,
        userMessage.id,
        result.code,
        result.retryable,
      );
    } catch (error) {
      return mapRepositoryError(error);
    }
    return { ...result, status: failureStatus(result) };
  }

  try {
    await completeConsultationTurn(input.supabase, {
      messageId: userMessage.id,
      pledgeVersion: context.version,
      result: result.value,
      metadata: result.metadata,
      model: input.config?.model ?? 'solar-pro3',
    });
    return {
      ok: true,
      turn: await getConsultationTurn(input.supabase, {
        id: userMessage.id,
        pledgeId: input.pledgeId,
        requestId: input.requestId,
        content: input.message,
        status: 'completed',
      }),
    };
  } catch (error) {
    if (
      error instanceof ConsultationRepositoryError &&
      error.code === 'turn_unavailable'
    ) {
      try {
        await markConsultationFailed(
          input.supabase,
          userMessage.id,
          'consultation_state_changed',
          false,
        );
      } catch {
        // Preserve the original state-conflict response if the failure marker cannot be written.
      }
      return {
        ok: false,
        code: 'consultation_state_changed',
        retryable: false,
        status: 409,
      };
    }
    return mapRepositoryError(error);
  }
}

const PENDING_TIMEOUT_MS = 120_000;
const CONSULTATION_MAX_EXISTING_MESSAGES = 19;

function isStale(updatedAt?: string) {
  if (!updatedAt) return false;
  const timestamp = Date.parse(updatedAt);
  return (
    !Number.isNaN(timestamp) && Date.now() - timestamp >= PENDING_TIMEOUT_MS
  );
}

function normalizeMessage(value: string) {
  return value.trim().normalize('NFC');
}

async function resolveConcurrentTurn(
  input: Parameters<typeof runStoredPledgeConsultation>[0],
  message: string,
): Promise<StoredConsultationResult> {
  try {
    const existing = await findConsultationTurn(
      input.supabase,
      input.pledgeId,
      input.requestId,
    );
    if (!existing)
      return {
        ok: false,
        code: 'consultation_storage_failed',
        retryable: true,
        status: 503,
      };
    if (normalizeMessage(existing.content) !== normalizeMessage(message))
      return {
        ok: false,
        code: 'idempotency_conflict',
        retryable: false,
        status: 409,
      };
    if (existing.status === 'completed')
      return {
        ok: true,
        turn: await getConsultationTurn(input.supabase, existing),
      };
    if (existing.status === 'pending')
      return {
        ok: false,
        code: 'consultation_in_progress',
        retryable: true,
        status: 409,
      };
    return {
      ok: false,
      code: existingFailureCode(existing),
      retryable: existing.failureRetryable === true,
      status: existing.failureRetryable === true ? 503 : 502,
    };
  } catch (error) {
    return mapRepositoryError(error);
  }
}

async function reopenFailedMessage(
  supabase: SupabaseClient,
  messageId: string,
) {
  const { data, error } = await supabase.rpc('retry_pledge_ai_consultation', {
    p_user_message_id: messageId,
  });
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
  };
}

function existingFailureCode(message: { failureCode?: string | null }) {
  return message.failureCode ?? 'consultation_failed';
}

function failureStatus(result: AiConsultationFailure) {
  if (result.code === 'rate_limited') return 429;
  if (result.code === 'request_timeout') return 504;
  if (result.code === 'grounding_failed') return 422;
  if (result.code === 'sensitive_input_detected') return 400;
  if (result.code === 'input_limit_exceeded') return 413;
  return result.retryable ? 503 : 502;
}

function mapRepositoryError(error: unknown): StoredConsultationResult {
  if (error instanceof ConsultationRepositoryError)
    switch (error.code) {
      case 'not_found':
        return { ok: false, code: 'not_found', retryable: false, status: 404 };
      case 'not_editable':
        return {
          ok: false,
          code: 'not_editable',
          retryable: false,
          status: 409,
        };
      case 'in_progress':
        return {
          ok: false,
          code: 'consultation_in_progress',
          retryable: true,
          status: 409,
        };
      case 'turn_unavailable':
        return {
          ok: false,
          code: 'consultation_state_changed',
          retryable: false,
          status: 409,
        };
      case 'lookup_failed':
      case 'save_failed':
        return { ok: false, code: error.code, retryable: true, status: 503 };
    }
  return {
    ok: false,
    code: 'consultation_storage_failed',
    retryable: true,
    status: 503,
  };
}
