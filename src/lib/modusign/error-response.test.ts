import { describe, expect, it } from 'vitest';

import { ModusignApiError } from './client';
import { getModusignErrorResponse } from './error-response';

describe('Modusign error response mapping', () => {
  it('separates timeout, rate limit, auth, and malformed response errors', () => {
    expect(
      getModusignErrorResponse(new ModusignApiError('timeout'), 'fallback'),
    ).toEqual({ code: 'modusign_timeout', status: 504 });
    expect(
      getModusignErrorResponse(
        new ModusignApiError('request_failed', 429),
        'fallback',
      ),
    ).toEqual({ code: 'modusign_rate_limited', status: 503 });
    expect(
      getModusignErrorResponse(
        new ModusignApiError('request_failed', 401),
        'fallback',
      ),
    ).toEqual({ code: 'modusign_auth_failed', status: 503 });
    expect(
      getModusignErrorResponse(
        new ModusignApiError('invalid_response'),
        'fallback',
      ),
    ).toEqual({ code: 'modusign_invalid_response', status: 502 });
  });

  it('does not expose unknown error details', () => {
    expect(getModusignErrorResponse(new Error('secret'), 'fallback')).toEqual({
      code: 'fallback',
      status: 502,
    });
  });
});
