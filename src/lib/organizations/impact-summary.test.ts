import { describe, expect, it } from 'vitest';

import { parseImpactSummaryJson } from './impact-summary';

describe('parseImpactSummaryJson', () => {
  it('normalizes an approved demo summary', () => {
    expect(
      parseImpactSummaryJson(
        {
          overview: '교육과 의료를 지원합니다.',
          reportingPeriod: '2025',
          limitations: ['향후 결과를 보장하지 않습니다.'],
        },
        null,
      ),
    ).toEqual({
      overview: '교육과 의료를 지원합니다.',
      reportingPeriod: '2025',
      limitations: ['향후 결과를 보장하지 않습니다.'],
    });
  });

  it('rejects a summary without an overview', () => {
    expect(parseImpactSummaryJson({ programs: [] }, '2025')).toBeNull();
  });
});
