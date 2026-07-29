import { describe, expect, it } from 'vitest';

import { getHealthStatus } from './health';

describe('getHealthStatus', () => {
  it('returns a healthy status', () => {
    expect(getHealthStatus()).toEqual({ status: 'ok' });
  });
});
