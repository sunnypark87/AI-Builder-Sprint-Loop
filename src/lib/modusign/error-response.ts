import { ModusignApiError } from './client';

export function getModusignErrorResponse(error: unknown, fallbackCode: string) {
  if (!(error instanceof ModusignApiError)) {
    return { code: fallbackCode, status: 502 } as const;
  }

  if (error.code === 'timeout') {
    return { code: 'modusign_timeout', status: 504 } as const;
  }

  if (error.code === 'invalid_response') {
    return { code: 'modusign_invalid_response', status: 502 } as const;
  }

  if (error.status === 401 || error.status === 403) {
    return { code: 'modusign_auth_failed', status: 503 } as const;
  }

  if (error.status === 429) {
    return { code: 'modusign_rate_limited', status: 503 } as const;
  }

  return { code: 'modusign_request_failed', status: 502 } as const;
}
