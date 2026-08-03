import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { createReportRepository } from './report-repository';

type QueryResult = { data: unknown[]; error: null };

function query(result: QueryResult) {
  const builder = {
    select: () => builder,
    in: () => builder,
    eq: () => builder,
    not: () => builder,
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}

describe('report repository', () => {
  it('keeps every registered plan with executions for the same donation eligible', async () => {
    const results: Record<string, QueryResult> = {
      organization_members: {
        data: [{ organization_id: 'organization-1' }],
        error: null,
      },
      organizations: {
        data: [{ id: 'organization-1', name: '기부처' }],
        error: null,
      },
      donations: {
        data: [
          {
            id: 'donation-1',
            organization_id: 'organization-1',
            pledge_id: 'pledge-1',
          },
        ],
        error: null,
      },
      pledges: {
        data: [
          {
            id: 'pledge-1',
            organization_id: 'organization-1',
            purpose: '급식 지원',
            status: 'signed',
          },
        ],
        error: null,
      },
      expenditure_plans: {
        data: [
          {
            id: 'plan-1',
            organization_id: 'organization-1',
            donation_id: 'donation-1',
            title: '상반기 계획',
            period_start: '2026-01-01',
            period_end: '2026-06-30',
          },
          {
            id: 'plan-2',
            organization_id: 'organization-1',
            donation_id: 'donation-1',
            title: '하반기 계획',
            period_start: '2026-07-01',
            period_end: '2026-12-31',
          },
        ],
        error: null,
      },
      expenditure_executions: {
        data: [
          { id: 'execution-1', plan_id: 'plan-1', donation_id: 'donation-1' },
          { id: 'execution-2', plan_id: 'plan-2', donation_id: 'donation-1' },
          { id: 'execution-3', plan_id: 'plan-2', donation_id: 'donation-1' },
        ],
        error: null,
      },
    };
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'manager-1' } },
          error: null,
        }),
      },
      from: (table: string) => query(results[table]),
    } as unknown as SupabaseClient;

    const eligible = await createReportRepository(client).listEligible();

    expect(eligible).toHaveLength(2);
    expect(eligible).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ planId: 'plan-1', executionCount: 1 }),
        expect.objectContaining({ planId: 'plan-2', executionCount: 2 }),
      ]),
    );
  });
});
