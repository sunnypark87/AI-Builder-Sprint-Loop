import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const { createClient, getCurrentUser } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/supabase/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

const validBody = {
  address: '부산시 해운대구',
  amount: 50000,
  contact: '010-0000-0000',
  donorName: '홍길동',
  donationType: 'cash',
  organizationSlug: 'haebom',
  pledgeDate: '2026-08-01',
  purpose: '교육 프로그램',
  receiptRequested: false,
};
const insertConversationMessages = vi.fn();

describe('POST /api/pledges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertConversationMessages.mockResolvedValue({ error: null });
    getCurrentUser.mockResolvedValue({ id: 'user-1' });
    createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'organizations') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'organization-1' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === 'pledge_chat_messages') {
          return { insert: insertConversationMessages };
        }

        return {
          insert: (value: unknown) => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'pledge-1' },
                error: null,
                inserted: value,
              }),
            }),
          }),
        };
      }),
    });
  });

  it('rejects anonymous requests', async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/pledges', {
        body: JSON.stringify(validBody),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
  });

  it('rejects invalid input before touching Supabase', async () => {
    const response = await POST(
      new Request('http://localhost/api/pledges', {
        body: JSON.stringify({ ...validBody, amount: 0 }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates a draft pledge for the authenticated donor', async () => {
    const response = await POST(
      new Request('http://localhost/api/pledges', {
        body: JSON.stringify(validBody),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      pledgeId: 'pledge-1',
      status: 'draft',
    });
  });

  it('creates an incomplete draft for the first consultation message', async () => {
    const response = await POST(
      new Request('http://localhost/api/pledges', {
        body: JSON.stringify({ organizationSlug: 'haebom' }),
        method: 'POST',
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      pledgeId: 'pledge-1',
      status: 'draft',
    });
  });

  it('rejects oversized consultation messages before creating a pledge', async () => {
    const response = await POST(
      new Request('http://localhost/api/pledges', {
        body: JSON.stringify({
          ...validBody,
          conversationMessages: [{ content: '가'.repeat(4001), role: 'user' }],
        }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'invalid_conversation_messages',
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('reports consultation message persistence failures', async () => {
    insertConversationMessages.mockResolvedValueOnce({
      error: { code: 'constraint_failed' },
    });

    const response = await POST(
      new Request('http://localhost/api/pledges', {
        body: JSON.stringify({
          ...validBody,
          conversationMessages: [{ content: '상담 내용', role: 'user' }],
        }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'pledge_conversation_save_failed',
      pledgeId: 'pledge-1',
    });
  });

  it('persists valid consultation messages with the new pledge', async () => {
    const response = await POST(
      new Request('http://localhost/api/pledges', {
        body: JSON.stringify({
          ...validBody,
          conversationMessages: [
            { content: '상담 내용', role: 'user' },
            { content: '상담 답변', role: 'assistant' },
          ],
        }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(201);
    expect(insertConversationMessages).toHaveBeenCalledWith([
      expect.objectContaining({ content: '상담 내용', pledge_id: 'pledge-1' }),
      expect.objectContaining({ content: '상담 답변', pledge_id: 'pledge-1' }),
    ]);
  });
});
