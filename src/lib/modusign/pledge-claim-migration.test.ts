import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../../../supabase/migrations/20260802070000_atomic_modusign_pledge_claim.sql',
    import.meta.url,
  ),
  'utf8',
);
const pledgeRoute = readFileSync(
  new URL('../../app/api/pledges/[pledgeId]/route.ts', import.meta.url),
  'utf8',
);

describe('atomic Modusign pledge claim migration', () => {
  it('locks and version-checks the pledge before freezing it', () => {
    expect(migration).toContain('for update');
    expect(migration).toContain('current_pledge.version <> p_expected_version');
    expect(migration).toContain("set status = 'awaiting_donor_signature'");
    expect(migration).toContain('insert into public.signature_documents');
  });

  it('prevents an already-read PATCH from overwriting a frozen pledge', () => {
    expect(pledgeRoute).toContain(".eq('status', 'draft')");
    expect(pledgeRoute).toContain(".eq('version', existing.version)");
    expect(pledgeRoute).toContain("{ code: 'pledge_changed' }");
  });

  it('keeps claim and finalize functions server-only', () => {
    expect(migration).toContain(
      'grant execute on function public.claim_modusign_signature_request',
    );
    expect(migration).toContain(
      'grant execute on function public.finalize_modusign_signature_request',
    );
    expect(migration).not.toMatch(/to authenticated/);
  });

  it('allows finalization after the pledge has been frozen', () => {
    expect(migration).toContain(
      "status in ('draft', 'awaiting_donor_signature')",
    );
  });
});
