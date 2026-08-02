import { describe, expect, it } from 'vitest';

import {
  formatIdentityNumberInput,
  formatMobilePhoneInput,
  isValidEmailInput,
  isValidIdentityNumberInput,
  isValidMobilePhoneInput,
} from './contact-format';

describe('pledge contact formatting', () => {
  it('formats identity numbers from digits only', () => {
    expect(formatIdentityNumberInput('9001011234567')).toBe('900101-1234567');
    expect(formatIdentityNumberInput('900101-1234567')).toBe('900101-1234567');
  });

  it('formats Korean mobile numbers from digits only', () => {
    expect(formatMobilePhoneInput('01012345678')).toBe('010-1234-5678');
    expect(formatMobilePhoneInput('010-1234-5678')).toBe('010-1234-5678');
  });

  it('validates complete identity, mobile, and email values', () => {
    expect(isValidIdentityNumberInput('900101-1234567')).toBe(true);
    expect(isValidIdentityNumberInput('900101-123')).toBe(false);
    expect(isValidMobilePhoneInput('010-1234-5678')).toBe(true);
    expect(isValidMobilePhoneInput('02-123-4567')).toBe(false);
    expect(isValidEmailInput('donor@example.com')).toBe(true);
    expect(isValidEmailInput('donor@invalid')).toBe(false);
  });
});
