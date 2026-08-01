import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const environmentExample = readFileSync(
  new URL('../../.env.example', import.meta.url),
  'utf8',
);
const variableNames = Array.from(
  environmentExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm),
  (match) => match[1],
);

describe('.env.example', () => {
  it('documents only the canonical application environment variables once', () => {
    expect(variableNames).toEqual([
      'UPSTAGE_API_KEY',
      'UPSTAGE_MODEL',
      'UPSTAGE_OCR_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ]);
    expect(new Set(variableNames).size).toBe(variableNames.length);
  });
});
