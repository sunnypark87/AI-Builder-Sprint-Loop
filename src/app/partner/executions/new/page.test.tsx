// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const listEligible = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/auth')>()),
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}));
vi.mock('@/lib/supabase/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/server')>()),
  createClient: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/executions/execution-repository', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/lib/executions/execution-repository')
  >()),
  createExecutionRepository: vi.fn().mockReturnValue({ listEligible }),
}));
vi.mock('@/components/partner/execution-upload-form', () => ({
  ExecutionUploadForm: ({ options }: { options: unknown[] }) => (
    <div data-testid="upload-form">선택지 {options.length}개</div>
  ),
}));

import Page from '@/app/partner/executions/new/page';

afterEach(() => {
  cleanup();
  listEligible.mockReset();
});

describe('new execution page', () => {
  it('shows a load error instead of an empty upload form when options fail', async () => {
    listEligible.mockRejectedValue(new Error('database unavailable'));

    render(await Page());

    expect(screen.getByRole('alert').textContent).toContain(
      '등록 가능한 계획 항목을 불러오지 못했습니다.',
    );
    expect(screen.queryByTestId('upload-form')).toBeNull();
  });

  it('keeps a successful empty result distinct from a load failure', async () => {
    listEligible.mockResolvedValue([]);

    render(await Page());

    expect(screen.getByTestId('upload-form').textContent).toBe('선택지 0개');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
