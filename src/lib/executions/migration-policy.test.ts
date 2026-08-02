import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/202608020000_create_expenditure_executions.sql',
  'utf8',
);

describe('execution migration security and atomicity', () => {
  it('enables RLS on every execution table and keeps documents private', () => {
    for (const table of [
      'expenditure_executions',
      'execution_receipts',
      'receipt_ocr_runs',
      'receipt_verification_results',
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(migration).toContain("'receipt-documents'");
    expect(migration).toMatch(/'receipt-documents',[\s\S]*?false,/);
  });

  it('locks the plan item and rechecks budget inside the registration RPC', () => {
    expect(migration).toContain('for update;');
    expect(migration).toContain('Remaining budget exceeded');
    expect(migration).toContain(
      'spent_amount + requested_amount > current_item.amount',
    );
  });

  it('recomputes the semantic key from the final reviewed draft', () => {
    expect(migration).toContain('final_semantic_key := case');
    expect(migration).toContain('semantic_key = final_semantic_key');
  });

  it('uses an expiring ownership token for analysis and retry writes', () => {
    expect(migration).toContain('analysis_lease_expires_at');
    expect(migration).toContain('analysis_lease_token');
    expect(migration).toContain('analysis_lease_token = p_lease_token');
    expect(migration).toContain('claim_execution_analysis_retry');
  });

  it('limits pending receipt documents to their uploader', () => {
    expect(migration).toContain("if path_segments[2] = 'pending' then");
    expect(migration).toContain('path_segments[3]::uuid = auth.uid()');
    expect(migration).toContain('array_length(path_segments, 1) = 4');
  });

  it('revokes public execution on every mutation function', () => {
    for (const name of [
      'create_expenditure_execution_analysis',
      'mark_execution_source_uploaded',
      'save_expenditure_execution_analysis',
      'mark_expenditure_execution_failed',
      'claim_execution_analysis_retry',
      'register_expenditure_execution',
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\(`),
      );
    }
  });
});
