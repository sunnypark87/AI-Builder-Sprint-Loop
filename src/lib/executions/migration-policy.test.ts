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

  it('revokes public execution on every mutation function', () => {
    for (const name of [
      'create_expenditure_execution_analysis',
      'save_expenditure_execution_analysis',
      'mark_expenditure_execution_failed',
      'register_expenditure_execution',
    ]) {
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\(`),
      );
    }
  });
});
