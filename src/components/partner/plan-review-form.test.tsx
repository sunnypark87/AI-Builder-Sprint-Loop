// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanReviewForm } from '@/components/partner/plan-review-form';
import type { PlanDraft } from '@/lib/plans/types';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const draft: PlanDraft = {
  title: '2026년 교육 지원',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  totalAmount: 100_000,
  items: [
    {
      id: 'item-1',
      name: '교재비',
      description: '',
      amount: 100_000,
      confidence: 0.98,
      sourceText: '교재비 100,000원',
      sourceName: '교재비',
      sourceAmount: 100_000,
    },
  ],
};

afterEach(() => {
  cleanup();
  push.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe('PlanReviewForm', () => {
  it('blocks registration when item sum and total do not match', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <PlanReviewForm
        initialDraft={draft}
        initialIssues={[]}
        planId="44444444-4444-4444-8444-444444444444"
      />,
    );

    const amount = screen.getByRole('spinbutton', {
      name: '금액',
    });
    await user.clear(amount);
    await user.type(amount, '90000');
    await user.click(screen.getByRole('button', { name: '검토 완료·등록' }));

    expect(
      screen.getByText('예산 항목 합계와 총 계획 예산이 일치하지 않습니다.'),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers a valid reviewed plan once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: 'registered' }, { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <PlanReviewForm
        initialDraft={draft}
        initialIssues={[]}
        planId="44444444-4444-4444-8444-444444444444"
      />,
    );

    await user.click(screen.getByRole('button', { name: '검토 완료·등록' }));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith('/partner/plans?status=registered');
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('submits a manually entered plan to the creation API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: 'registered' }, { status: 201 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      randomUUID: () => '55555555-5555-4555-8555-555555555555',
    });
    const user = userEvent.setup();
    render(
      <PlanReviewForm
        donations={[
          {
            id: '33333333-3333-4333-8333-333333333333',
            organizationId: '22222222-2222-4222-8222-222222222222',
            label: '기부 내역 33333333',
          },
        ]}
        initialDraft={draft}
        initialIssues={[]}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: '대상 기부 내역' }),
      '33333333-3333-4333-8333-333333333333',
    );
    await user.click(screen.getByRole('button', { name: '계획 등록' }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/partner/plans');
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toMatchObject({
      mode: 'manual',
      organizationId: '22222222-2222-4222-8222-222222222222',
      donationId: '33333333-3333-4333-8333-333333333333',
      idempotencyKey: 'manual-plan:55555555-5555-4555-8555-555555555555',
      draft,
    });
    expect(push).toHaveBeenCalledWith('/partner/plans?status=registered');
  });

  it('renders an already registered plan as read-only', () => {
    render(
      <PlanReviewForm
        initialDraft={draft}
        initialIssues={[]}
        planId="44444444-4444-4444-8444-444444444444"
        readOnly
      />,
    );

    expect(screen.getByText('내부 등록이 완료됐습니다.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '검토 완료·등록' })).toBeNull();
    expect(screen.queryByRole('button', { name: '예산 항목 추가' })).toBeNull();
    expect(
      (screen.getByRole('textbox', { name: '계획명' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });
});
