import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260803000000_create_donation_reports.sql',
  'utf8',
);

describe('donation report migration security and atomicity', () => {
  it('links donations to pledges without invalidating legacy rows', () => {
    expect(migration).toContain('add column if not exists pledge_id uuid');
    expect(migration).toContain('where pledge_id is not null');
  });

  it('grants only the pledge access required by report readers and server workflows', () => {
    const grantMigration = readFileSync(
      new URL(
        '../../../supabase/migrations/20260803010000_grant_pledge_access_for_reports.sql',
        import.meta.url,
      ),
      'utf8',
    );

    expect(grantMigration).toContain(
      'grant select on public.pledges to authenticated',
    );
    expect(grantMigration).toContain(
      'grant select, insert, update, delete on public.pledges to service_role',
    );
    expect(grantMigration).not.toMatch(
      /grant\s+(?:all|insert|update|delete).*public\.pledges\s+to\s+authenticated/i,
    );
  });

  it('enables RLS and exposes only published reports to their donor', () => {
    expect(migration).toContain(
      'alter table public.donation_reports enable row level security',
    );
    expect(migration).toContain("status = 'published'");
    expect(migration).toContain('pledge.donor_user_id = (select auth.uid())');
    expect(migration).not.toMatch(
      /grant (insert|update|delete)[^;]*authenticated/i,
    );
  });

  it('uses lease ownership for generation and retry writes', () => {
    expect(migration).toContain('generation_lease_token = p_lease_token');
    expect(migration).toContain('claim_donation_report_retry');
    expect(migration).toContain("now() + interval '2 minutes'");
  });

  it('publishes the immutable snapshot and event in one RPC', () => {
    expect(migration).toContain('published_content = p_draft_content');
    expect(migration).toContain(
      "'report_published:' || target_report.id::text",
    );
    expect(migration).toContain('insert into public.donation_report_events');
  });

  it('revokes public execution for every mutation RPC', () => {
    for (const name of [
      'create_donation_report_generation',
      'save_donation_report_generation',
      'mark_donation_report_generation_failed',
      'claim_donation_report_retry',
      'save_donation_report_draft',
      'publish_donation_report',
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\(`),
      );
    }
  });
});
