import { NextResponse } from 'next/server';

import {
  ConsultationRepositoryError,
  getStoredConsultationContext,
} from '@/lib/pledges/ai-consultation-repository';
import { runStoredPledgeConsultation } from '@/lib/pledges/stored-ai-consultation-service';
import type {
  ConsultationHistoryResponse,
  ConsultationMessageResponse,
  ConsultationTurnResponse,
} from '@/lib/pledges/ai-consultation-api';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { getSuggestedReplies } from '@/lib/pledges/consultation-suggestions';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ pledgeId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError('unauthorized', 401);
  const { pledgeId } = await context.params;
  const supabase = await createClient();
  try {
    await getStoredConsultationContext(supabase, pledgeId, user.id, {
      requireEditable: false,
    });
    const { data: messages, error: messageError } = await supabase
      .from('pledge_chat_messages')
      .select(
        'id, role, content, status, proposed_patch, created_at, updated_at, reply_to_message_id, failure_code, failure_retryable',
      )
      .eq('pledge_id', pledgeId)
      .order('created_at', { ascending: true });
    if (messageError) return jsonError('chat_lookup_failed', 503);
    const response: ConsultationHistoryResponse = {
      messages: (messages ?? []).map(toMessage),
    };
    return NextResponse.json(response);
  } catch (error) {
    return repositoryErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return jsonError('unauthorized', 401);
  const { pledgeId } = await context.params;
  const requestId = request.headers.get('idempotency-key');
  if (!requestId || !isUuid(requestId))
    return jsonError('invalid_idempotency_key', 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('invalid_json', 400);
  }
  if (
    !isRecord(body) ||
    Object.keys(body).some((key) => key !== 'message') ||
    typeof body.message !== 'string' ||
    !body.message.trim()
  )
    return jsonError('invalid_message', 400);

  const supabase = await createClient();
  const result = await runStoredPledgeConsultation({
    supabase,
    userId: user.id,
    pledgeId,
    requestId,
    message: body.message.trim(),
  });
  if (!result.ok)
    return NextResponse.json(
      {
        error: {
          code: result.code,
          ...(result.reason ? { reason: result.reason } : {}),
          ...(result.kinds ? { kinds: result.kinds } : {}),
          retryable: result.retryable,
        },
      },
      { status: result.status ?? 503 },
    );
  return NextResponse.json(toTurn(result.turn), { status: 200 });
}

function toTurn(turn: {
  message: { id: string; content: string; status: string; createdAt?: string };
  assistantMessage: { id: string; content: string } | null;
  proposal: Record<string, unknown> | null;
}): ConsultationTurnResponse {
  return {
    userMessage: {
      id: turn.message.id,
      role: 'user',
      content: turn.message.content,
      status: messageStatus(turn.message.status),
    },
    assistantMessage: turn.assistantMessage
      ? {
          id: turn.assistantMessage.id,
          role: 'assistant',
          content: turn.assistantMessage.content,
          status: 'completed',
          suggestedReplies: getSuggestedReplies(
            typeof turn.proposal?.next_question_field === 'string'
              ? turn.proposal.next_question_field
              : null,
          ),
        }
      : null,
    appliedPatch: isRecord(turn.proposal?.proposed_patch)
      ? turn.proposal.proposed_patch
      : {},
    missingFields: stringArray(turn.proposal?.missing_fields),
    nextQuestionField:
      typeof turn.proposal?.next_question_field === 'string'
        ? turn.proposal.next_question_field
        : null,
  };
}

function toMessage(
  value: Record<string, unknown>,
): ConsultationMessageResponse {
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    role: value.role === 'user' ? 'user' : 'assistant',
    content: typeof value.content === 'string' ? value.content : '',
    status: messageStatus(value.status),
    ...(typeof value.failure_code === 'string'
      ? {
          failure: {
            code: value.failure_code,
            retryable: value.failure_retryable === true,
          },
        }
      : {}),
    proposedPatch: isRecord(value.proposed_patch)
      ? value.proposed_patch
      : undefined,
    createdAt:
      typeof value.created_at === 'string' ? value.created_at : undefined,
    updatedAt:
      typeof value.updated_at === 'string' ? value.updated_at : undefined,
  };
}

function messageStatus(value: unknown): ConsultationMessageResponse['status'] {
  return value === 'pending' || value === 'failed' ? value : 'completed';
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function repositoryErrorResponse(error: unknown) {
  if (error instanceof ConsultationRepositoryError) {
    if (error.code === 'not_found') return jsonError('pledge_not_found', 404);
    if (error.code === 'not_editable')
      return jsonError('pledge_not_editable', 409);
  }
  return jsonError('chat_lookup_failed', 503);
}

function jsonError(code: string, status: number) {
  return NextResponse.json({ code }, { status });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
