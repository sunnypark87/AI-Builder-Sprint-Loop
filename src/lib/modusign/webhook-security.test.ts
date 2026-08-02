import { describe, expect, it } from 'vitest';

import { hasValidModusignWebhookSecret } from './webhook-security';

describe('Modusign webhook secret validation', () => {
  it('accepts an exact secret and rejects missing or different values', () => {
    expect(hasValidModusignWebhookSecret('secret', 'secret')).toBe(true);
    expect(hasValidModusignWebhookSecret('wrong', 'secret')).toBe(false);
    expect(hasValidModusignWebhookSecret(null, 'secret')).toBe(false);
    expect(hasValidModusignWebhookSecret('secret', undefined)).toBe(false);
  });
});
