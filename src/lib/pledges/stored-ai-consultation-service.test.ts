import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  completeConsultationTurn: vi.fn(),
  createPendingUserMessage: vi.fn(),
  findConsultationTurn: vi.fn(),
  getConsultationTurn: vi.fn(),
  getStoredConsultationContext: vi.fn(),
  markConsultationFailed: vi.fn(),
  recoverStaleConsultationMessage: vi.fn(),
  ConsultationRepositoryError: class ConsultationRepositoryError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  },
}));
const consultPledge = vi.hoisted(() => vi.fn());

vi.mock('./ai-consultation-repository', () => repository);
vi.mock('./ai-consultation-service', () => ({ consultPledge }));

import { runStoredPledgeConsultation } from './stored-ai-consultation-service';

const context = {
  pledgeId: 'pledge-1',
  organization: {
    id: 'org-1',
    name: '해봄',
    description: '아동 교육 지원',
    activityAreas: [],
    supportedPrograms: [],
    donationPolicy: null,
  },
  currentPledge: {},
  version: 1,
  status: 'draft',
  messages: [],
};
const userMessage = {
  id: 'message-1',
  pledgeId: 'pledge-1',
  requestId: '11111111-1111-4111-8111-111111111111',
  content: '교육에 기부하고 싶어요.',
  status: 'pending' as const,
};

describe('stored AI consultation service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.getStoredConsultationContext.mockResolvedValue(context);
    repository.findConsultationTurn.mockResolvedValue(null);
    repository.createPendingUserMessage.mockResolvedValue(userMessage);
    repository.getConsultationTurn.mockResolvedValue({
      message: { ...userMessage, status: 'completed' },
      assistantMessage: { id: 'assistant-1', content: '확인해 주세요.' },
      proposal: { id: 'proposal-1' },
    });
    repository.completeConsultationTurn.mockResolvedValue({
      assistantMessageId: 'assistant-1',
      proposalId: 'proposal-1',
    });
  });

  it('rejects sensitive input before creating a database message', async () => {
    const result = await runStoredPledgeConsultation({
      supabase: {} as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: '주민번호 900101-1234567을 보낼게요.',
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'sensitive_input_detected',
    });
    expect(repository.createPendingUserMessage).not.toHaveBeenCalled();
    expect(consultPledge).not.toHaveBeenCalled();
  });

  it('keeps a safe user message as failed when AI fails', async () => {
    consultPledge.mockResolvedValue({
      ok: false,
      code: 'request_timeout',
      retryable: true,
    });
    const result = await runStoredPledgeConsultation({
      supabase: {} as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: userMessage.content,
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'request_timeout',
      retryable: true,
    });
    expect(repository.markConsultationFailed).toHaveBeenCalledWith(
      {},
      'message-1',
      'request_timeout',
      true,
    );
  });

  it('rejects a reused idempotency key with a different message', async () => {
    repository.findConsultationTurn.mockResolvedValue({
      ...userMessage,
      content: '100만 원을 기부할게요.',
      status: 'completed',
    });
    const result = await runStoredPledgeConsultation({
      supabase: {} as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: '500만 원을 기부할게요.',
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'idempotency_conflict',
      status: 409,
    });
    expect(consultPledge).not.toHaveBeenCalled();
  });

  it('recovers a stale pending turn without creating a new user message', async () => {
    repository.findConsultationTurn.mockResolvedValue({
      ...userMessage,
      updatedAt: new Date(Date.now() - 121_000).toISOString(),
    });
    repository.recoverStaleConsultationMessage.mockResolvedValue(userMessage);
    consultPledge.mockResolvedValue({
      ok: false,
      code: 'request_timeout',
      retryable: true,
    });
    const result = await runStoredPledgeConsultation({
      supabase: {} as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: userMessage.content,
    });
    expect(result).toMatchObject({ ok: false, code: 'request_timeout' });
    expect(repository.recoverStaleConsultationMessage).toHaveBeenCalled();
    expect(repository.createPendingUserMessage).not.toHaveBeenCalled();
  });

  it('saves the AI answer and proposal only after a successful result', async () => {
    consultPledge.mockResolvedValue({
      ok: true,
      value: {
        assistantMessage: '확인해 주세요.',
        proposedPatch: { donationDesignation: 'designated' },
        missingFields: ['paymentMethod'],
        confirmationFields: ['donationDesignation'],
        conflictFields: [],
        nextQuestionField: 'paymentMethod',
      },
      metadata: {
        model: 'solar-pro3',
        requestId: 'provider-1',
        attempts: 1,
        durationMs: 20,
        usage: null,
      },
    });
    const result = await runStoredPledgeConsultation({
      supabase: {} as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: userMessage.content,
      config: {
        apiKey: 'secret',
        baseUrl: 'https://example.test/v1',
        model: 'solar-pro3',
        timeoutMs: 1000,
      },
    });
    expect(result).toMatchObject({ ok: true });
    expect(repository.completeConsultationTurn).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        messageId: 'message-1',
        pledgeVersion: 1,
      }),
    );
    expect(repository.markConsultationFailed).not.toHaveBeenCalled();
  });

  it('resolves a concurrent insert race as in progress when the winner is pending', async () => {
    repository.createPendingUserMessage.mockRejectedValue(
      new repository.ConsultationRepositoryError('in_progress'),
    );
    repository.findConsultationTurn
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...userMessage, status: 'pending' });

    const result = await runStoredPledgeConsultation({
      supabase: {} as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: userMessage.content,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'consultation_in_progress',
      retryable: true,
      status: 409,
    });
    expect(consultPledge).not.toHaveBeenCalled();
  });

  it('returns the winner result when a concurrent insert completed first', async () => {
    repository.createPendingUserMessage.mockRejectedValue(
      new repository.ConsultationRepositoryError('in_progress'),
    );
    repository.findConsultationTurn
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...userMessage, status: 'completed' });

    const result = await runStoredPledgeConsultation({
      supabase: {} as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: userMessage.content,
    });

    expect(result).toMatchObject({ ok: true });
    expect(repository.getConsultationTurn).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ status: 'completed' }),
    );
    expect(consultPledge).not.toHaveBeenCalled();
  });

  it('resolves stale recovery and failed retry races through the same lookup', async () => {
    repository.findConsultationTurn
      .mockResolvedValueOnce({
        ...userMessage,
        status: 'pending',
        updatedAt: new Date(Date.now() - 121_000).toISOString(),
      })
      .mockResolvedValueOnce({ ...userMessage, status: 'completed' });
    repository.recoverStaleConsultationMessage.mockRejectedValue(
      new repository.ConsultationRepositoryError('in_progress'),
    );

    const recoveredResult = await runStoredPledgeConsultation({
      supabase: {} as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: userMessage.content,
    });

    expect(recoveredResult).toMatchObject({ ok: true });
    expect(consultPledge).not.toHaveBeenCalled();

    const rpcSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'consultation_turn_not_available' },
      }),
    };
    repository.findConsultationTurn
      .mockResolvedValueOnce({
        ...userMessage,
        status: 'failed',
        failureRetryable: true,
        failureCode: 'request_timeout',
      })
      .mockResolvedValueOnce({ ...userMessage, status: 'pending' });
    const retryResult = await runStoredPledgeConsultation({
      supabase: rpcSupabase as never,
      userId: 'user-1',
      pledgeId: 'pledge-1',
      requestId: userMessage.requestId,
      message: userMessage.content,
    });

    expect(retryResult).toMatchObject({
      ok: false,
      code: 'consultation_in_progress',
      retryable: true,
      status: 409,
    });
  });
});
