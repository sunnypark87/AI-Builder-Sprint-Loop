import { createExecutionRepository } from '@/lib/executions/execution-repository';
import { describe, expect, it, vi } from 'vitest';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function query(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe('createExecutionRepository getReview', () => {
  it('propagates OCR audit query failures instead of returning blank evidence', async () => {
    const executionId = '77777777-7777-4777-8777-777777777777';
    const organizationId = '22222222-2222-4222-8222-222222222222';
    const donationId = '33333333-3333-4333-8333-333333333333';
    const planId = '44444444-4444-4444-8444-444444444444';
    const planItemId = '55555555-5555-4555-8555-555555555555';
    const executionQueries = [
      query({
        data: {
          id: executionId,
          organization_id: organizationId,
          donation_id: donationId,
          plan_id: planId,
          plan_item_id: planItemId,
          status: 'registered',
          draft_data: {
            merchantName: '모두마트',
            businessNumber: '1208155297',
            transactionAt: '2026-08-02T14:30',
            supplyAmount: 1819,
            taxAmount: 181,
            totalAmount: 2000,
            paymentMethod: '카드',
            approvalNumber: '12345678',
            items: [],
          },
          validation_issues: [],
          verification_results: [],
          warning_reason: '',
        },
        error: null,
      }),
      query({ data: [{ total_amount: 2000 }], error: null }),
    ];
    const queries: Record<string, ReturnType<typeof query>[]> = {
      expenditure_executions: executionQueries,
      execution_receipts: [
        query({
          data: {
            source_path: `${organizationId}/${executionId}/source.png`,
            source_file_name: 'receipt.png',
            source_mime_type: 'image/png',
            source_fingerprint: 'a'.repeat(64),
          },
          error: null,
        }),
      ],
      donations: [
        query({
          data: {
            id: donationId,
            organization_id: organizationId,
            amount: 10000,
            status: 'refunded',
            paid_at: '2026-08-01T00:00:00Z',
            paid_at_is_authoritative: true,
          },
          error: null,
        }),
      ],
      expenditure_plans: [
        query({
          data: {
            id: planId,
            title: '8월 급식 계획',
            organization_id: organizationId,
            donation_id: donationId,
            period_start: '2026-08-01',
            period_end: '2026-08-31',
          },
          error: null,
        }),
      ],
      expenditure_plan_items: [
        query({
          data: { id: planItemId, name: '식재료', amount: 10000 },
          error: null,
        }),
      ],
      receipt_ocr_runs: [
        query({ data: null, error: { message: 'OCR audit unavailable' } }),
      ],
    };
    const supabase = {
      from: vi.fn((table: string) => queries[table].shift()),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://example.test/receipt' },
            error: null,
          }),
        })),
      },
    };
    const repository = createExecutionRepository(
      supabase as unknown as Parameters<typeof createExecutionRepository>[0],
    );

    await expect(repository.getReview(executionId)).rejects.toThrow(
      '집행 내역 저장소 오류: OCR audit unavailable',
    );
  });
});
