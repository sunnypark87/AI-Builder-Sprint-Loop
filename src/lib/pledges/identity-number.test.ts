import { randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decryptIdentityNumber,
  encryptIdentityNumber,
  identityNumberLast4,
  isValidIdentityNumber,
  normalizeIdentityNumber,
} from './identity-number';

describe('identity number protection', () => {
  beforeEach(() => {
    vi.stubEnv('PLEDGE_PII_ENCRYPTION_KEY', randomBytes(32).toString('base64'));
  });

  it('normalizes, validates, and encrypts without storing plaintext', () => {
    const value = '900101-1234567';
    const encrypted = encryptIdentityNumber(value);

    expect(normalizeIdentityNumber(value)).toBe('9001011234567');
    expect(isValidIdentityNumber(value)).toBe(true);
    expect(identityNumberLast4(value)).toBe('4567');
    expect(encrypted.ciphertext).not.toContain('9001011234567');
    expect(decryptIdentityNumber(encrypted)).toBe('9001011234567');
  });
});
