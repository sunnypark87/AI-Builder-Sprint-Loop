import {
  recoverModelConsultationOutput,
  type ModelConsultationOutput,
} from '@/lib/pledges/ai-schema';
import { UpstageChatError } from './chat-error';

type RecordValue = Record<string, unknown>;

export function parseUpstageChatResponse(
  value: unknown,
): ModelConsultationOutput {
  if (
    !isRecord(value) ||
    !Array.isArray(value.choices) ||
    value.choices.length === 0
  ) {
    throw new UpstageChatError(
      'invalid_response',
      'AI 상담 응답 형식을 확인할 수 없습니다.',
      true,
    );
  }
  const choice = value.choices[0];
  if (
    !isRecord(choice) ||
    !isRecord(choice.message) ||
    typeof choice.message.content !== 'string' ||
    !choice.message.content.trim()
  ) {
    throw new UpstageChatError(
      'empty_response',
      'AI 상담 응답이 비어 있습니다.',
      true,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(choice.message.content);
  } catch {
    throw new UpstageChatError(
      'invalid_response',
      'AI 상담 응답이 JSON 형식이 아닙니다.',
      true,
    );
  }
  const result = recoverModelConsultationOutput(parsed);
  if (!result.ok)
    throw new UpstageChatError(
      'schema_validation_failed',
      'AI 상담 응답 형식이 약정 계약과 일치하지 않습니다.',
      false,
    );
  return result.value;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
