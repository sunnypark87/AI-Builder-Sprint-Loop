import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execution: vi.fn(),
  removeSource: vi.fn(),
}));

vi.mock('@/lib/supabase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/auth')>()),
  requireUserId: vi
    .fn()
    .mockResolvedValue('11111111-1111-4111-8111-111111111111'),
}));
vi.mock('@/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/server')>()),
  createClient: vi.fn().mockResolvedValue({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: mocks.execution,
      };
      return query;
    },
  }),
  createServiceClient: vi.fn().mockReturnValue({}),
}));
vi.mock('@/lib/executions/execution-repository', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/lib/executions/execution-repository')
  >()),
  createExecutionRepository: vi.fn().mockReturnValue({
    removeSource: mocks.removeSource,
  }),
}));

import { DELETE, POST } from '@/app/api/partner/executions/upload-url/route';

const sourcePath =
  '22222222-2222-4222-8222-222222222222/pending/11111111-1111-4111-8111-111111111111/66666666-6666-4666-8666-666666666666/source.png';

afterEach(() => {
  mocks.execution.mockReset();
  mocks.removeSource.mockReset();
});

describe('POST /api/partner/executions/upload-url', () => {
  it('rejects unsupported metadata before authentication or storage access', async () => {
    const response = await POST(
      new Request('http://localhost/api/partner/executions/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: 'not-a-uuid',
          mimeType: 'text/plain',
          size: 1,
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_file', retryable: false },
    });
  });
});

describe('DELETE /api/partner/executions/upload-url', () => {
  it('preserves a pending upload when its analysis request was created', async () => {
    mocks.execution.mockResolvedValue({
      data: { id: '77777777-7777-4777-8777-777777777777' },
      error: null,
    });

    const response = await DELETE(
      new Request('http://localhost/api/partner/executions/upload-url', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath,
          idempotencyKey: 'execution:66666666-6666-4666-8666-666666666666',
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(mocks.removeSource).not.toHaveBeenCalled();
  });

  it('removes an abandoned pending upload when no analysis exists', async () => {
    mocks.execution.mockResolvedValue({ data: null, error: null });
    mocks.removeSource.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request('http://localhost/api/partner/executions/upload-url', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath,
          idempotencyKey: 'execution:66666666-6666-4666-8666-666666666666',
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(mocks.removeSource).toHaveBeenCalledWith(sourcePath);
  });
});
