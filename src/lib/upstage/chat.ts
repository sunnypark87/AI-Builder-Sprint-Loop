import {
  getUpstageChatConfig,
  UpstageChatConfigError,
  type UpstageChatConfig,
} from './chat-config';
import { mapUpstageStatusError, UpstageChatError } from './chat-error';
import { parseUpstageChatResponse } from './chat-response';
import type { ModelConsultationOutput } from '@/lib/pledges/ai-schema';

export type UpstageChatMessage = { role: 'system' | 'user'; content: string };
export type UpstageChatUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};
export type UpstageChatCompletion = {
  output: ModelConsultationOutput;
  requestId: string | null;
  usage: UpstageChatUsage | null;
  attempts: number;
  durationMs: number;
};

export async function completeUpstageChat(input: {
  messages: UpstageChatMessage[];
  config?: UpstageChatConfig;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}): Promise<UpstageChatCompletion> {
  let config: UpstageChatConfig;
  try {
    config = input.config ?? getUpstageChatConfig();
  } catch (error) {
    if (error instanceof UpstageChatConfigError)
      throw new UpstageChatError('configuration_error', error.message, false);
    throw error;
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const sleep =
    input.sleepImpl ??
    ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: UpstageChatError | null = null;
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await requestOnce(config, input.messages, fetchImpl);
      return {
        ...result,
        attempts: attempt + 1,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const mapped =
        error instanceof UpstageChatError
          ? error
          : new UpstageChatError(
              'network_error',
              'AI 상담 서비스에 연결할 수 없습니다.',
              true,
            );
      lastError = mapped;
      if (!mapped.retryable) throw mapped;
      if (attempt === 1)
        throw new UpstageChatError(
          mapped.code,
          mapped.message,
          false,
          mapped.status,
          mapped.requestId,
          mapped.retryAfterMs,
        );
      await sleep(mapped.retryAfterMs ?? 300);
    }
  }
  throw (
    lastError ??
    new UpstageChatError(
      'network_error',
      'AI 상담 서비스에 연결할 수 없습니다.',
      true,
    )
  );
}

async function requestOnce(
  config: UpstageChatConfig,
  messages: UpstageChatMessage[],
  fetchImpl: typeof fetch,
): Promise<Omit<UpstageChatCompletion, 'attempts' | 'durationMs'>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: controller.signal,
    });
    const requestId = response.headers.get('x-request-id');
    if (!response.ok)
      throw mapUpstageStatusError(
        response.status,
        requestId,
        parseRetryAfter(response.headers.get('retry-after')),
      );
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new UpstageChatError(
        'invalid_response',
        'AI 상담 응답을 읽을 수 없습니다.',
        false,
        response.status,
        requestId,
      );
    }
    return {
      output: parseUpstageChatResponse(payload),
      requestId,
      usage: parseUsage(payload),
    };
  } catch (error) {
    if (error instanceof UpstageChatError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new UpstageChatError(
        'request_timeout',
        'AI 상담 시간이 초과되었습니다.',
        true,
      );
    throw new UpstageChatError(
      'network_error',
      'AI 상담 서비스에 연결할 수 없습니다.',
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(Math.round(seconds * 1000), 3_000);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return Math.min(Math.max(timestamp - Date.now(), 0), 3_000);
}

function parseUsage(value: unknown): UpstageChatUsage | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('usage' in value) ||
    typeof value.usage !== 'object' ||
    value.usage === null
  )
    return null;
  const usage = value.usage as Record<string, unknown>;
  return {
    ...(typeof usage.prompt_tokens === 'number'
      ? { promptTokens: usage.prompt_tokens }
      : {}),
    ...(typeof usage.completion_tokens === 'number'
      ? { completionTokens: usage.completion_tokens }
      : {}),
    ...(typeof usage.total_tokens === 'number'
      ? { totalTokens: usage.total_tokens }
      : {}),
  };
}
