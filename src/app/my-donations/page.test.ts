import { describe, expect, it } from 'vitest';

import { dynamic } from './page';

describe('my donations page rendering mode', () => {
  it('keeps authenticated donation history out of build-time prerendering', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
