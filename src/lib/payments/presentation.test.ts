import { describe, expect, it } from 'vitest';

import { getPaymentStatusPresentation } from './presentation';

describe('payment status presentation', () => {
  it('maps persisted demo payment states to UI labels and tones', () => {
    expect(getPaymentStatusPresentation('completed')).toEqual({
      label: '결제 완료',
      tone: 'success',
    });
    expect(getPaymentStatusPresentation('failed')).toEqual({
      label: '결제 실패',
      tone: 'danger',
    });
  });

  it('falls back to payment waiting for missing or unknown states', () => {
    expect(getPaymentStatusPresentation(null)).toEqual({
      label: '결제 대기',
      tone: 'neutral',
    });
    expect(getPaymentStatusPresentation('unexpected')).toEqual({
      label: '결제 대기',
      tone: 'neutral',
    });
  });
});
