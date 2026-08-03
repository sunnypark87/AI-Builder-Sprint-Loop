import { describe, expect, it } from 'vitest';

import { parseKoreanMetric } from '../../../scripts/impact-source-parser.mjs';

describe('impact source Korean metric parser', () => {
  it('keeps Korean place-value components in compound amounts', () => {
    expect(parseKoreanMetric('2억 5천만원')).toEqual({
      numericValue: 250_000_000,
      textValue: null,
      unit: '원',
    });
  });

  it('parses small Korean units without a currency suffix', () => {
    expect(parseKoreanMetric('3천명')).toEqual({
      numericValue: 3000,
      textValue: null,
      unit: '명',
    });
  });

  it('keeps comparisons and ranges as source text', () => {
    expect(parseKoreanMetric('1,460명 (전년 1,200명)')).toMatchObject({
      numericValue: null,
      textValue: '1,460명 (전년 1,200명)',
    });
    expect(parseKoreanMetric('100~200명')).toMatchObject({
      numericValue: null,
      textValue: '100~200명',
    });
  });
});
