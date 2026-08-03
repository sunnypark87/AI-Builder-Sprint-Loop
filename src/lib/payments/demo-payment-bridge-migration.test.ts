import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260803120000_bridge_demo_payment_to_donation.sql',
  'utf8',
);

describe('demo payment donation bridge migration', () => {
  it('handles the partial pledge unique index without an invalid conflict target', () => {
    expect(migration).toContain('on conflict do nothing');
    expect(migration).not.toContain('on conflict (pledge_id) do nothing');
  });

  it('keeps the bridge server-only and validates signed completed payments', () => {
    expect(migration).toContain("target_pledge.status <> 'signed'");
    expect(migration).toContain("target_payment.status <> 'completed'");
    expect(migration).toContain('from public, authenticated');
    expect(migration).toContain('to service_role');
  });
});
