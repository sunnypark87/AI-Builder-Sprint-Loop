import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../../../supabase/migrations/202607310001_create_expenditure_plans.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('expenditure plan migration security', () => {
  it('enables RLS for every exposed plan table', () => {
    for (const table of [
      'expenditure_plans',
      'expenditure_plan_items',
      'plan_ocr_runs',
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
  });

  it('creates a private source bucket with organization policies', () => {
    expect(migration).toContain("'plan-documents'");
    expect(migration).toMatch(/'plan-documents',\s*'plan-documents',\s*false,/);
    expect(migration).toContain('private.can_access_plan_document(name)');
    expect(migration).not.toContain(
      'Organization members can delete plan documents',
    );
    expect(migration).not.toContain(
      'Organization members can upload plan documents',
    );
  });

  it('keeps anonymous access disabled and scopes app access to server or users', () => {
    expect(migration).not.toMatch(/\bto anon\b/);
    expect(migration).toContain('to service_role');
    expect(migration).toContain('to authenticated');
    expect(migration).toContain('auth.uid()');
  });

  it('keeps mutations server-only and validates lifecycle eligibility', () => {
    expect(migration).not.toMatch(
      /grant execute on function public\.[\s\S]*?to authenticated/,
    );
    expect(migration).toContain("donation.status = 'paid'");
    expect(migration).toContain('analysis_lease_expires_at');
    expect(migration).toContain('analysis_lease_token');
    expect(migration).toContain('analysis_lease_token = p_lease_token');
    expect(migration).toContain("interval '2 minutes'");
  });
});
