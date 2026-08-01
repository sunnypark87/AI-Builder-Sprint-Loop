// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanUploadForm } from '@/components/partner/plan-upload-form';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

describe('PlanUploadForm', () => {
  it('uploads the selected donation plan and opens its review page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          planId: '44444444-4444-4444-8444-444444444444',
          status: 'review_required',
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', {
      randomUUID: () => '55555555-5555-4555-8555-555555555555',
    });
    const user = userEvent.setup();

    render(
      <PlanUploadForm
        donations={[
          {
            id: '33333333-3333-4333-8333-333333333333',
            organizationId: '22222222-2222-4222-8222-222222222222',
            label: '2026년 교육 지원 기부',
          },
        ]}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: '대상 기부 내역' }),
      '33333333-3333-4333-8333-333333333333',
    );
    await user.upload(
      screen.getByLabelText(/집행 계획서/),
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        'plan.png',
        { type: 'image/png' },
      ),
    );
    fireEvent.submit(
      screen.getByRole('button', { name: '계획서 분석' }).closest('form')!,
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/partner/plans/44444444-4444-4444-8444-444444444444/review',
      );
    });
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get('organizationId')).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(body.get('idempotencyKey')).toMatch(/^plan:/);
  });

  it('disables submission when no eligible donation exists', () => {
    render(<PlanUploadForm donations={[]} />);

    expect(
      (
        screen.getByRole('button', {
          name: '계획서 분석',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText('등록 가능한 기부 내역이 없습니다.')).toBeTruthy();
  });

  it('reuses the idempotency key after an uncertain network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(
        Response.json(
          {
            planId: '44444444-4444-4444-8444-444444444444',
            status: 'review_required',
          },
          { status: 201 },
        ),
      );
    const randomUUID = vi
      .fn()
      .mockReturnValue('55555555-5555-4555-8555-555555555555');
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID });
    const user = userEvent.setup();

    render(
      <PlanUploadForm
        donations={[
          {
            id: '33333333-3333-4333-8333-333333333333',
            organizationId: '22222222-2222-4222-8222-222222222222',
            label: '2026년 교육 지원 기부',
          },
        ]}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: '대상 기부 내역' }),
      '33333333-3333-4333-8333-333333333333',
    );
    await user.upload(
      screen.getByLabelText(/집행 계획서/),
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'plan.png', {
        type: 'image/png',
      }),
    );
    const form = screen
      .getByRole('button', { name: '계획서 분석' })
      .closest('form')!;

    fireEvent.submit(form);
    await screen.findByText(
      '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const firstBody = fetchMock.mock.calls[0][1]?.body as FormData;
    const secondBody = fetchMock.mock.calls[1][1]?.body as FormData;
    expect(firstBody.get('idempotencyKey')).toBe(
      secondBody.get('idempotencyKey'),
    );
    expect(randomUUID).toHaveBeenCalledOnce();
  });
});
