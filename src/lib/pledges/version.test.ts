import { describe, expect, it } from 'vitest';

import { isExpectedPledgeVersion } from './version';

describe('isExpectedPledgeVersion', () => {
  it('accepts an omitted or current expected version', () => {
    expect(isExpectedPledgeVersion(undefined, 3)).toBe(true);
    expect(isExpectedPledgeVersion(3, 3)).toBe(true);
  });

  it('rejects stale, future, and malformed expected versions', () => {
    expect(isExpectedPledgeVersion(2, 3)).toBe(false);
    expect(isExpectedPledgeVersion(4, 3)).toBe(false);
    expect(isExpectedPledgeVersion('3', 3)).toBe(false);
  });
});
