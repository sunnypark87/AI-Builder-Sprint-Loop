export type UpstageChatErrorCode =
  | 'configuration_error'
  | 'authentication_failed'
  | 'rate_limited'
  | 'request_timeout'
  | 'network_error'
  | 'upstream_unavailable'
  | 'invalid_request'
  | 'invalid_response'
  | 'empty_response'
  | 'schema_validation_failed';

export class UpstageChatError extends Error {
  constructor(
    public readonly code: UpstageChatErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly status: number | null = null,
    public readonly requestId: string | null = null,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'UpstageChatError';
  }
}

export function mapUpstageStatusError(
  status: number,
  requestId: string | null = null,
  retryAfterMs: number | null = null,
): UpstageChatError {
  if (status === 401 || status === 403)
    return new UpstageChatError(
      'authentication_failed',
      'AI 상담 서비스 인증에 실패했습니다.',
      false,
      status,
      requestId,
      retryAfterMs,
    );
  if (status === 429)
    return new UpstageChatError(
      'rate_limited',
      'AI 상담 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      true,
      status,
      requestId,
      retryAfterMs,
    );
  if (status === 408)
    return new UpstageChatError(
      'request_timeout',
      'AI 상담 시간이 초과되었습니다.',
      true,
      status,
      requestId,
    );
  if (status >= 500)
    return new UpstageChatError(
      'upstream_unavailable',
      'AI 상담 서비스가 응답하지 않았습니다.',
      true,
      status,
      requestId,
    );
  return new UpstageChatError(
    'invalid_request',
    'AI 상담 요청을 처리할 수 없습니다.',
    false,
    status,
    requestId,
  );
}
