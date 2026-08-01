// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanRetryButton } from '@/components/partner/plan-retry-button';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe('PlanRetryButton', () => {
  it('offers a new upload when no source document is available', () => {
    render(
      <PlanRetryButton
        canRetry={false}
        planId="44444444-4444-4444-8444-444444444444"
      />,
    );

    expect(
      screen.getByRole('link', { name: '다시 업로드' }).getAttribute('href'),
    ).toBe('/partner/plans/new');
  });

  it('retries a failed plan and opens the review page', async () => {
    const planId = '44444444-4444-4444-8444-444444444444';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ planId, status: 'review_required' }));
    vi.stubGlobal('fetch', fetchMock);

    render(<PlanRetryButton planId={planId} />);
    await userEvent.click(screen.getByRole('button', { name: '재시도' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/partner/plans/${planId}/review`);
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/partner/plans/${planId}`, {
      method: 'POST',
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('shows a safe API error and remains retryable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: '문서 분석 요청이 많습니다.' } },
            { status: 429 },
          ),
        ),
    );

    render(<PlanRetryButton planId="44444444-4444-4444-8444-444444444444" />);
    await userEvent.click(screen.getByRole('button', { name: '재시도' }));

    expect(await screen.findByText('문서 분석 요청이 많습니다.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: '재시도' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('stays on the list while another retry request is processing', async () => {
    const planId = '44444444-4444-4444-8444-444444444444';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ planId, status: 'analyzing', duplicate: true }),
        ),
    );

    render(<PlanRetryButton planId={planId} />);
    await userEvent.click(screen.getByRole('button', { name: '재시도' }));

    expect(
      await screen.findByText(
        '재분석이 아직 진행 중입니다. 잠시 후 확인해 주세요.',
      ),
    ).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
