import {
  buildConsultationPrompt,
  CONSULTATION_SYSTEM_PROMPT,
  type ConsultationMessage,
} from './consultation-prompt';
import { normalizeConsultationResult } from './consultation-normalizer';
import { composeConsultationAssistantMessage } from './consultation-response';
import type {
  OrganizationAiContext,
  PledgeConsultationResult,
} from './ai-schema';
import type { PledgeAiContext } from './consultation-context';
import { completeUpstageChat } from '@/lib/upstage/chat';
import type { UpstageChatConfig } from '@/lib/upstage/chat-config';
import {
  UpstageChatError,
  type UpstageChatErrorCode,
} from '@/lib/upstage/chat-error';

export type AiConsultationFailure =
  | {
      ok: false;
      code: 'sensitive_input_detected';
      kinds: string[];
      retryable: false;
    }
  | {
      ok: false;
      code: 'input_limit_exceeded';
      reason: string;
      retryable: false;
    }
  | {
      ok: false;
      code:
        | 'configuration_error'
        | 'authentication_failed'
        | 'rate_limited'
        | 'request_timeout'
        | 'network_error'
        | 'upstream_unavailable'
        | 'invalid_request'
        | 'invalid_response'
        | 'empty_response'
        | 'schema_validation_failed'
        | 'grounding_failed';
      retryable: boolean;
      requestId?: string | null;
    };

export type AiConsultationSuccess = {
  ok: true;
  value: PledgeConsultationResult;
  metadata: {
    model: string;
    requestId: string | null;
    attempts: number;
    durationMs: number;
    usage: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    } | null;
  };
};

export async function consultPledge(input: {
  organization: OrganizationAiContext;
  currentPledge: PledgeAiContext;
  messages: ConsultationMessage[];
  fetchImpl?: typeof fetch;
  config?: UpstageChatConfig;
}): Promise<AiConsultationSuccess | AiConsultationFailure> {
  const prompt = buildConsultationPrompt(
    input.organization,
    input.currentPledge,
    input.messages,
  );
  if (!prompt.ok)
    return prompt.code === 'sensitive_input_detected'
      ? { ok: false, code: prompt.code, kinds: prompt.kinds, retryable: false }
      : {
          ok: false,
          code: prompt.code,
          reason: prompt.reason,
          retryable: false,
        };
  try {
    const completion = await completeUpstageChat({
      fetchImpl: input.fetchImpl,
      config: input.config,
      messages: [
        { role: 'system', content: CONSULTATION_SYSTEM_PROMPT },
        { role: 'user', content: prompt.value },
      ],
    });
    const normalized = normalizeConsultationResult({
      modelOutput: completion.output,
      currentPledge: input.currentPledge,
      organization: input.organization,
      latestUserMessage:
        [...input.messages].reverse().find((message) => message.role === 'user')
          ?.content ?? '',
    });
    if (!normalized.ok)
      return { ok: false, code: 'grounding_failed', retryable: false };
    const value = {
      ...normalized.value,
      assistantMessage: composeConsultationAssistantMessage(normalized.value),
    };
    return {
      ok: true,
      value,
      metadata: {
        model: completion.model,
        requestId: completion.requestId,
        attempts: completion.attempts,
        durationMs: completion.durationMs,
        usage: completion.usage,
      },
    };
  } catch (error) {
    const isUpstageError = error instanceof UpstageChatError;
    return {
      ok: false,
      code: isUpstageError ? mapFailureCode(error.code) : 'network_error',
      retryable: isUpstageError ? error.retryable : true,
      ...(isUpstageError ? { requestId: error.requestId } : {}),
    };
  }
}

function mapFailureCode(
  code: UpstageChatErrorCode,
): Exclude<
  AiConsultationFailure,
  { code: 'sensitive_input_detected' | 'input_limit_exceeded' }
>['code'] {
  return code;
}
