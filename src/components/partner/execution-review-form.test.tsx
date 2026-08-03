// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExecutionReviewForm } from '@/components/partner/execution-review-form';
import type { ReceiptDraft } from '@/lib/executions/types';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

const draft: ReceiptDraft = {
  merchantName: '모두마트',
  businessNumber: '1208155297',
  transactionAt: '2026-08-02T14:30',
  supplyAmount: 1819,
  taxAmount: 181,
  totalAmount: 2000,
  paymentMethod: '카드',
  approvalNumber: '12345678',
  items: [
    {
      id: 'item-1',
      name: '생수',
      quantity: 2,
      amount: 2000,
      confidence: 0.9,
      sourceText: '품목: 생수',
      sourceName: '생수',
      sourceAmount: 2000,
    },
  ],
};

const planItemOptions = [
  {
    planItemId: '55555555-5555-4555-8555-555555555555',
    planItemName: '식재료',
    remainingBudget: 10000,
  },
  {
    planItemId: '66666666-6666-4666-8666-666666666666',
    planItemName: '생활용품',
    remainingBudget: 8000,
  },
];

afterEach(() => {
  cleanup();
  push.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe('ExecutionReviewForm', () => {
  it('submits reviewed values and offers AI report creation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ executionId: 'execution-1', status: 'registered' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <ExecutionReviewForm
        executionId="77777777-7777-4777-8777-777777777777"
        initialPlanItemId={planItemOptions[0].planItemId}
        initialDraft={draft}
        initialIssues={[]}
        initialVerificationResults={[
          {
            code: 'donation_paid_at',
            version: 1,
            outcome: 'warning',
            message: '결제 시각을 확인해 주세요.',
            evidence: '결제 확정 시각 없음',
          },
        ]}
        initialWarningReason=""
        planItemOptions={planItemOptions}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText('계획 예산 항목'),
      planItemOptions[1].planItemId,
    );
    await user.type(
      screen.getByLabelText('검증 경고 확인 사유'),
      '원본과 결제 내역을 직접 대조했습니다.',
    );
    await user.click(
      screen.getByRole('button', { name: '검토 완료·내부 등록' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/partner/executions/77777777-7777-4777-8777-777777777777',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('원본과 결제 내역을 직접 대조했습니다.'),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject(
      {
        planItemId: planItemOptions[1].planItemId,
      },
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole('link', { name: 'AI 보고서 작성하기' })
          .getAttribute('href'),
      ).toBe('/partner/reports/new'),
    );
    expect(
      screen.getByRole('link', { name: '집행 내역 목록' }).getAttribute('href'),
    ).toBe('/partner/executions?status=registered');
    expect(push).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('allows corrected values to be resubmitted while showing a blocking rule', () => {
    render(
      <ExecutionReviewForm
        executionId="77777777-7777-4777-8777-777777777777"
        initialPlanItemId={planItemOptions[0].planItemId}
        initialDraft={draft}
        initialIssues={[]}
        initialVerificationResults={[
          {
            code: 'remaining_budget',
            version: 1,
            outcome: 'blocked',
            message: '예산 잔액을 초과했습니다.',
            evidence: '2000 / 1000',
          },
        ]}
        initialWarningReason=""
        planItemOptions={[{ ...planItemOptions[0], remainingBudget: 1000 }]}
      />,
    );
    expect(
      (
        screen.getByRole('button', {
          name: '검토 완료·내부 등록',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(screen.getByText('등록 차단')).toBeTruthy();
  });

  it('allows the reviewer to add and remove item rows', async () => {
    const user = userEvent.setup();
    render(
      <ExecutionReviewForm
        executionId="77777777-7777-4777-8777-777777777777"
        initialPlanItemId={planItemOptions[0].planItemId}
        initialDraft={draft}
        initialIssues={[]}
        initialVerificationResults={[]}
        initialWarningReason=""
        planItemOptions={planItemOptions}
      />,
    );

    await user.click(screen.getByRole('button', { name: '품목 추가' }));
    expect(screen.getByLabelText('품목 2')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '품목 1 삭제' }));
    expect(screen.queryByDisplayValue('생수')).toBeNull();
    expect((screen.getByLabelText('품목 1') as HTMLInputElement).value).toBe(
      '',
    );
  });

  it('shows the saved warning acknowledgement in read-only evidence', () => {
    render(
      <ExecutionReviewForm
        executionId="77777777-7777-4777-8777-777777777777"
        initialPlanItemId={planItemOptions[0].planItemId}
        initialDraft={draft}
        initialIssues={[]}
        initialVerificationResults={[
          {
            code: 'donation_paid_at',
            version: 1,
            outcome: 'warning',
            message: '결제 시각을 확인해 주세요.',
            evidence: '결제 확정 시각 없음',
          },
        ]}
        initialWarningReason="원본과 결제 내역을 직접 대조했습니다."
        planItemOptions={planItemOptions}
        readOnly
      />,
    );

    expect(screen.getByText('검증 경고 확인 사유')).toBeTruthy();
    expect(
      screen.getByText('원본과 결제 내역을 직접 대조했습니다.'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('textbox', { name: '검증 경고 확인 사유' }),
    ).toBeNull();
  });
});
