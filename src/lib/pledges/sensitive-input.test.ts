import { describe, expect, it } from 'vitest';

import {
  containsSensitiveInput,
  findSensitiveInput,
  maskSensitiveInput,
} from './sensitive-input';

describe('sensitive consultation input', () => {
  it('detects and masks identity numbers', () => {
    const value = '주민번호는 900101-1234567입니다.';
    expect(containsSensitiveInput(value)).toBe(true);
    expect(findSensitiveInput(value)[0]?.kind).toBe('identity_number');
    expect(maskSensitiveInput(value)).toContain('[민감정보 마스킹]');
    expect(maskSensitiveInput(value)).not.toContain('900101-1234567');
  });

  it('detects secret-like assignments', () => {
    expect(containsSensitiveInput('api_key=secret-value')).toBe(true);
  });

  it('detects Korean bank account numbers before model calls', () => {
    const value = '납부 계좌는 110-123-456789입니다.';
    expect(containsSensitiveInput(value)).toBe(true);
    expect(findSensitiveInput(value)[0]?.kind).toBe('bank_account');
    expect(maskSensitiveInput(value)).not.toContain('110-123-456789');
  });

  it('does not reject ordinary donation amounts', () => {
    expect(containsSensitiveInput('매달 10만원을 기부하고 싶어요')).toBe(false);
  });

  it('prioritizes identity numbers over overlapping card-number matches', () => {
    expect(findSensitiveInput('900101-1234567')).toEqual([
      { kind: 'identity_number', start: 0, end: 14 },
    ]);
  });
});
