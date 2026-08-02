import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, getCurrentUser, runStoredPledgeConsultation } =
  vi.hoisted(() => ({
    createClient: vi.fn(),
    getCurrentUser: vi.fn(),
    runStoredPledgeConsultation: vi.fn(),
  }));

vi.mock('@/lib/supabase/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock('@/lib/pledges/stored-ai-consultation-service', () => ({
  runStoredPledgeConsultation,
}));
vi.mock('@/lib/pledges/ai-consultation-repository', () => ({
  ConsultationRepositoryError: class ConsultationRepositoryError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  },
  getStoredConsultationContext: vi.fn(),
}));

import { POST } from './route';

const context = { params: Promise.resolve({ pledgeId: 'pledge-1' }) };
const requestId = '11111111-1111-4111-8111-111111111111';

describe('POST /api/pledges/[pledgeId]/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: 'user-1' });
    createClient.mockResolvedValue({});
  });

  it('rejects anonymous requests', async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await POST(
      new Request('http://localhost', { method: 'POST' }),
      context,
    );
    expect(response.status).toBe(401);
    expect(runStoredPledgeConsultation).not.toHaveBeenCalled();
  });

  it('requires an idempotency key and valid message', async () => {
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ message: '확인' }),
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect(runStoredPledgeConsultation).not.toHaveBeenCalled();
  });

  it('returns the stored consultation turn on success', async () => {
    runStoredPledgeConsultation.mockResolvedValue({
      ok: true,
      turn: {
        message: { id: 'user-message', content: '확인', status: 'completed' },
        assistantMessage: {
          id: 'assistant-message',
          content: '납부 수단을 알려주세요.',
        },
        proposal: {
          id: 'proposal-1',
          proposed_patch: { donationDesignation: 'designated' },
          status: 'pending',
          confirmation_fields: ['donationDesignation'],
          conflict_fields: [],
          missing_fields: ['paymentMethod'],
          next_question_field: 'paymentMethod',
        },
      },
    });
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'idempotency-key': requestId },
        body: JSON.stringify({ message: '확인' }),
      }),
      context,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userMessage: { id: 'user-message', status: 'completed' },
      assistantMessage: { content: '납부 수단을 알려주세요.' },
      appliedPatch: { donationDesignation: 'designated' },
      nextQuestionField: 'paymentMethod',
    });
    expect(runStoredPledgeConsultation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        pledgeId: 'pledge-1',
        requestId,
        message: '확인',
      }),
    );
  });

  it('maps stored consultation failures to safe HTTP errors', async () => {
    runStoredPledgeConsultation.mockResolvedValue({
      ok: false,
      code: 'rate_limited',
      retryable: true,
      status: 429,
    });
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'idempotency-key': requestId },
        body: JSON.stringify({ message: '확인' }),
      }),
      context,
    );
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'rate_limited', retryable: true },
    });
  });
});
