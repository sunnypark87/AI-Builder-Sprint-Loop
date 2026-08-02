import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  createPlanRepository,
  getPlanRecoveryState,
} from '@/lib/plans/plan-repository';

describe('getPlanRecoveryState', () => {
  const now = new Date('2026-08-01T00:02:00.000Z').getTime();

  it('does not offer recovery while an analysis lease is active', () => {
    expect(
      getPlanRecoveryState(
        'analyzing',
        'organization/plan/source.pdf',
        '2026-08-01T00:03:00.000Z',
        null,
        now,
      ),
    ).toEqual({ canRetry: false, needsReupload: false });
  });

  it('offers retry for an expired analysis with a stored source', () => {
    expect(
      getPlanRecoveryState(
        'analyzing',
        'organization/plan/source.pdf',
        '2026-08-01T00:01:00.000Z',
        null,
        now,
      ),
    ).toEqual({ canRetry: true, needsReupload: false });
  });

  it('requires reupload for a failed plan without a stored source', () => {
    expect(
      getPlanRecoveryState(
        'analysis_failed',
        null,
        null,
        'source_upload_failed',
        now,
      ),
    ).toEqual({ canRetry: false, needsReupload: true });
  });

  it('offers retry for a failed plan with a stored source', () => {
    expect(
      getPlanRecoveryState(
        'analysis_failed',
        'organization/plan/source.pdf',
        null,
        'rate_limited',
        now,
      ),
    ).toEqual({ canRetry: true, needsReupload: false });
  });

  it('does not offer retry for an authentication failure', () => {
    expect(
      getPlanRecoveryState(
        'analysis_failed',
        'organization/plan/source.pdf',
        null,
        'authentication_failed',
        now,
      ),
    ).toEqual({ canRetry: false, needsReupload: false });
  });

  it('does not offer retry for an upstream request rejection', () => {
    expect(
      getPlanRecoveryState(
        'analysis_failed',
        'organization/plan/source.pdf',
        null,
        'upstream_rejected',
        now,
      ),
    ).toEqual({ canRetry: false, needsReupload: false });
  });

  it('requires a new upload for a rejected upstream document', () => {
    expect(
      getPlanRecoveryState(
        'analysis_failed',
        'organization/plan/source.pdf',
        null,
        'invalid_request',
        now,
      ),
    ).toEqual({ canRetry: false, needsReupload: true });
  });
});

describe('promoteSource', () => {
  it('recovers when a previous request already moved the final source', async () => {
    const move = vi.fn().mockResolvedValue({ error: new Error('exists') });
    const exists = vi.fn().mockResolvedValue({ data: true, error: null });
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const storage = { from: () => ({ move, exists, remove }) };
    const client = { storage } as unknown as SupabaseClient;
    const repository = createPlanRepository(client, {
      actorUserId: '11111111-1111-4111-8111-111111111111',
      client,
    });
    const pending = 'organization/pending/user/upload/source.png';

    await expect(
      repository.promoteSource(
        '44444444-4444-4444-8444-444444444444',
        '22222222-2222-4222-8222-222222222222',
        pending,
        new File(['png'], 'plan.png', { type: 'image/png' }),
        null,
      ),
    ).resolves.toBe(
      '22222222-2222-4222-8222-222222222222/44444444-4444-4444-8444-444444444444/source.png',
    );
    expect(remove).toHaveBeenCalledWith([pending]);
  });
});

describe('createManualPlan', () => {
  it('uses the atomic manual registration RPC with the authenticated actor', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        plan_id: '44444444-4444-4444-8444-444444444444',
        created: true,
      },
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ single });
    const readClient = {} as SupabaseClient;
    const mutationClient = { rpc } as unknown as SupabaseClient;
    const repository = createPlanRepository(readClient, {
      actorUserId: '11111111-1111-4111-8111-111111111111',
      client: mutationClient,
    });
    const draft = {
      title: '8월 급식 계획',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      totalAmount: 200_000,
      items: [
        {
          id: 'item-1',
          name: '식재료',
          description: '급식 재료 구입',
          amount: 200_000,
          confidence: null,
          sourceText: '',
          sourceName: '',
          sourceAmount: null,
        },
      ],
    };

    await expect(
      repository.createManualPlan({
        organizationId: '22222222-2222-4222-8222-222222222222',
        donationId: '33333333-3333-4333-8333-333333333333',
        userId: '11111111-1111-4111-8111-111111111111',
        idempotencyKey: 'manual-plan:55555555-5555-4555-8555-555555555555',
        draft,
      }),
    ).resolves.toEqual({
      id: '44444444-4444-4444-8444-444444444444',
      created: true,
    });
    expect(rpc).toHaveBeenCalledWith('create_manual_expenditure_plan', {
      p_actor_id: '11111111-1111-4111-8111-111111111111',
      p_organization_id: '22222222-2222-4222-8222-222222222222',
      p_donation_id: '33333333-3333-4333-8333-333333333333',
      p_idempotency_key: 'manual-plan:55555555-5555-4555-8555-555555555555',
      p_draft: draft,
    });
  });
});
