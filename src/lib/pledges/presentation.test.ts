import { describe, expect, it } from 'vitest';

import { getPledgeStatusPresentation } from './presentation';

describe('pledge status presentation', () => {
  it('maps signing and completed states for donor history', () => {
    expect(
      getPledgeStatusPresentation('awaiting_organization_signature'),
    ).toEqual({
      label: '기부처 서명 대기',
      tone: 'warning',
    });
    expect(getPledgeStatusPresentation('signed')).toEqual({
      label: '양측 서명 완료',
      tone: 'success',
    });
  });

  it('falls back safely for unknown states', () => {
    expect(getPledgeStatusPresentation('unknown')).toEqual({
      label: '상태 확인 필요',
      tone: 'neutral',
    });
  });
});
