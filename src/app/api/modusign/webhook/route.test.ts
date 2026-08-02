import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));
const { applyModusignSnapshot, createModusignClient } = vi.hoisted(() => ({
  applyModusignSnapshot: vi.fn(),
  createModusignClient: vi.fn(),
}));

let afterCallback: (() => Promise<void>) | null = null;

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn((callback: () => Promise<void>) => {
    afterCallback = callback;
  }),
}));

vi.mock('@/lib/modusign/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modusign/client')>()),
  createModusignClient,
}));
vi.mock('@/lib/modusign/snapshot-sync', () => ({ applyModusignSnapshot }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }));

function adminClient(claimResult: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: claimResult, error }),
  };
}

function processingAdminClient() {
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }));
  return {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => {
          if (table === 'signature_documents') {
            return {
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'document-1',
                  pledge_id: 'pledge-1',
                  provider_document_id: 'provider-1',
                },
                error: null,
              }),
            };
          }
          if (table === 'pledges') {
            return {
              single: vi.fn().mockResolvedValue({
                data: { id: 'pledge-1', status: 'awaiting_donor_signature' },
                error: null,
              }),
            };
          }
          return Promise.resolve({
            data: [
              {
                id: 'participant-1',
                provider_participant_id: 'donor-participant-1',
                role: 'donor',
                signed_at: null,
                status: 'waiting',
              },
            ],
            error: null,
          });
        },
      }),
      update,
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

const validPayload = {
  documentId: 'provider-1',
  eventId: 'event-1',
  eventType: 'document_all_signed',
};

describe('POST /api/modusign/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallback = null;
    process.env.MODUSIGN_WEBHOOK_SECRET = 'test-secret';
  });

  it('rejects an invalid webhook secret before parsing or storing data', async () => {
    const response = await POST(
      new Request('http://localhost/api/modusign/webhook', {
        body: JSON.stringify(validPayload),
        headers: { 'x-modusign-webhook-secret': 'wrong-secret' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects malformed payloads without calling Supabase', async () => {
    const response = await POST(
      new Request('http://localhost/api/modusign/webhook', {
        body: JSON.stringify({ eventType: 'document_all_signed' }),
        headers: { 'x-modusign-webhook-secret': 'test-secret' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('returns duplicate for an already processed event', async () => {
    createAdminClient.mockReturnValue(adminClient('processed'));

    const response = await POST(
      new Request('http://localhost/api/modusign/webhook', {
        body: JSON.stringify(validPayload),
        headers: { 'x-modusign-webhook-secret': 'test-secret' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'duplicate' });
  });

  it('returns a service error when the event claim cannot be stored', async () => {
    createAdminClient.mockReturnValue(
      adminClient(null, new Error('db failure')),
    );

    const response = await POST(
      new Request('http://localhost/api/modusign/webhook', {
        body: JSON.stringify(validPayload),
        headers: { 'x-modusign-webhook-secret': 'test-secret' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'webhook_event_claim_failed',
    });
  });

  it('accepts an event and processes the claimed snapshot asynchronously', async () => {
    const admin = processingAdminClient();
    createAdminClient.mockReturnValue(admin);
    createModusignClient.mockReturnValue({
      getDocument: vi.fn().mockResolvedValue({
        id: 'provider-1',
        participants: [
          {
            id: 'donor-participant-1',
            name: '테스트 기부자',
            signingOrder: 1,
            status: 'SIGNED',
            type: 'SIGNER',
          },
        ],
        signings: [],
        status: 'ON_GOING',
        title: '기부 약정서',
      }),
    });
    applyModusignSnapshot.mockResolvedValue('awaiting_organization_signature');
    admin.rpc.mockResolvedValueOnce({ data: 'claimed', error: null });

    const response = await POST(
      new Request('http://localhost/api/modusign/webhook', {
        body: JSON.stringify(validPayload),
        headers: { 'x-modusign-webhook-secret': 'test-secret' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ status: 'accepted' });
    expect(afterCallback).toBeTypeOf('function');
    await afterCallback?.();
    expect(createModusignClient).toHaveBeenCalledOnce();
    expect(applyModusignSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPledgeStatus: 'awaiting_donor_signature',
        documentId: 'document-1',
        eventId: 'event-1',
      }),
    );
  });
});
