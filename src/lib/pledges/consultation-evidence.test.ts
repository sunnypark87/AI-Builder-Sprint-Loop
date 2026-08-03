import { describe, expect, it } from 'vitest';

import { parseKoreanWon } from './consultation-evidence';

describe('consultation evidence', () => {
  it.each([
    ['10만원 기부할게요', 100_000],
    ['100,000원을 기부할게요', 100_000],
    ['1.5백만원을 기부할게요', 1_500_000],
    ['2억원을 기부할게요', 200_000_000],
    ['100000', 100_000],
  ])('parses an explicit Korean donation amount: %s', (message, amount) => {
    expect(parseKoreanWon(message)).toBe(amount);
  });

  it.each(['기부할게요', '2026년 8월에 기부할게요', '많이 기부할게요'])(
    'does not invent an amount from unrelated text: %s',
    (message) => {
      expect(parseKoreanWon(message)).toBeNull();
    },
  );
});
