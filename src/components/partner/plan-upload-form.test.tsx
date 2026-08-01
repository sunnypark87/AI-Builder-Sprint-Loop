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
const uploadToSignedUrl = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: () => ({ uploadToSignedUrl }) },
  }),
}));

const preparedUpload = {
  sourcePath:
    '22222222-2222-4222-8222-222222222222/pending/11111111-1111-4111-8111-111111111111/66666666-6666-4666-8666-666666666666/source.png',
  token: 'signed-upload-token',
};

afterEach(() => {
  cleanup();
  push.mockReset();
  uploadToSignedUrl.mockClear();
  vi.unstubAllGlobals();
});

describe('PlanUploadForm', () => {
  it('uploads the selected donation plan and opens its review page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(preparedUpload))
      .mockResolvedValueOnce(
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
    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      preparedUpload.sourcePath,
      preparedUpload.token,
      expect.any(File),
      expect.objectContaining({ contentType: 'image/png' }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.organizationId).toBe('22222222-2222-4222-8222-222222222222');
    expect(body.idempotencyKey).toMatch(/^plan:/);
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
      .mockResolvedValueOnce(Response.json(preparedUpload))
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json(preparedUpload))
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    const firstBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const cleanupBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[4][1]?.body));
    expect(firstBody.idempotencyKey).toBe(secondBody.idempotencyKey);
    expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE');
    expect(cleanupBody.sourcePath).toBe(preparedUpload.sourcePath);
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('retries a retryable OCR failure on the existing plan', async () => {
    const planId = '44444444-4444-4444-8444-444444444444';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(preparedUpload))
      .mockResolvedValueOnce(
        Response.json(
          {
            planId,
            error: {
              message: '문서 분석 시간이 초과되었습니다.',
              retryable: true,
            },
          },
          { status: 502 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({ planId, status: 'review_required' }),
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
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'plan.png', {
        type: 'image/png',
      }),
    );

    fireEvent.submit(
      screen.getByRole('button', { name: '계획서 분석' }).closest('form')!,
    );
    await screen.findByRole('button', { name: '계획서 재분석' });
    fireEvent.submit(
      screen.getByRole('button', { name: '계획서 재분석' }).closest('form')!,
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/partner/plans/${planId}/review`);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(`/api/partner/plans/${planId}`);
    expect(uploadToSignedUrl).toHaveBeenCalledOnce();
  });

  it('keeps the idempotency key while an earlier analysis lease is active', async () => {
    const planId = '44444444-4444-4444-8444-444444444444';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(preparedUpload))
      .mockResolvedValueOnce(
        Response.json({ planId, status: 'analyzing', duplicate: true }),
      )
      .mockResolvedValueOnce(Response.json(preparedUpload))
      .mockResolvedValueOnce(
        Response.json({ planId, status: 'review_required', duplicate: true }),
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
    await screen.findByText(/이전 분석이 아직 진행 중입니다/);
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    const firstBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[3][1]?.body));
    expect(firstBody.idempotencyKey).toBe(secondBody.idempotencyKey);
    expect(randomUUID).toHaveBeenCalledOnce();
  });
});
