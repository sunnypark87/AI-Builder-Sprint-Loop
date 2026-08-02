import { describe, expect, it } from 'vitest';

import { dynamic } from './layout';

describe('partner layout rendering mode', () => {
  it('keeps authenticated partner pages out of build-time prerendering', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
