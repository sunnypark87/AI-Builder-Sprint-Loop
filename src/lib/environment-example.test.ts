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
      'UPSTAGE_OCR_MODEL',
      'UPSTAGE_CHAT_MODEL',
      'UPSTAGE_CHAT_TIMEOUT_MS',
      'UPSTAGE_OCR_URL',
      'MODUSIGN_AUTH_KEY',
      'MODUSIGN_TEMPLATE_ID',
      'MODUSIGN_WEBHOOK_SECRET',
      'NEXT_PUBLIC_SITE_URL',
      'DEMO_DONOR_EMAIL',
      'DEMO_DONOR_PASSWORD',
      'DEMO_ORGANIZATION_EMAIL',
      'DEMO_ORGANIZATION_PASSWORD',
      'DEMO_ORGANIZATION_SIGNER_NAME',
      'DEMO_ORGANIZATION_SLUG',
      'RLS_PLEDGE_ID',
      'RLS_VIEWER_EMAIL',
      'RLS_VIEWER_PASSWORD',
      'RLS_OTHER_ORGANIZATION_EMAIL',
      'RLS_OTHER_ORGANIZATION_PASSWORD',
      'PLEDGE_IDENTITY_NUMBER_ENABLED',
      'PLEDGE_PII_ENCRYPTION_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'SUPABASE_SECRET_KEY',
    ]);
    expect(new Set(variableNames).size).toBe(variableNames.length);
  });
});
