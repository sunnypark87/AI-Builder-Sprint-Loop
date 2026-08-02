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

import { ExecutionUploadForm } from '@/components/partner/execution-upload-form';

const push = vi.fn();
const uploadToSignedUrl = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: { from: () => ({ uploadToSignedUrl }) },
  }),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  uploadToSignedUrl.mockClear();
  vi.unstubAllGlobals();
});

describe('ExecutionUploadForm', () => {
  it('uploads a receipt and opens the dynamic review screen', async () => {
    const sourcePath =
      '22222222-2222-4222-8222-222222222222/pending/11111111-1111-4111-8111-111111111111/66666666-6666-4666-8666-666666666666/source.png';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ sourcePath, token: 'signed-token' }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            executionId: '77777777-7777-4777-8777-777777777777',
            status: 'verification_warning',
          },
          { status: 201 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <ExecutionUploadForm
        options={[
          {
            organizationId: '22222222-2222-4222-8222-222222222222',
            donationId: '33333333-3333-4333-8333-333333333333',
            planId: '44444444-4444-4444-8444-444444444444',
            planTitle: '8월 급식 계획',
            planItemId: '55555555-5555-4555-8555-555555555555',
            planItemName: '식재료',
            remainingBudget: 10000,
          },
        ]}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText('계획 예산 항목'),
      '55555555-5555-4555-8555-555555555555',
    );
    fireEvent.change(screen.getByLabelText(/영수증 원본/), {
      target: {
        files: [new File(['receipt'], 'receipt.png', { type: 'image/png' })],
      },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: '영수증 분석' }).closest('form')!,
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/partner/executions/77777777-7777-4777-8777-777777777777/review',
      );
    });
    expect(uploadToSignedUrl).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains why registration is unavailable without eligible plans', () => {
    render(<ExecutionUploadForm options={[]} />);
    expect(
      screen.getByText('등록 가능한 계획 예산 항목이 없습니다.'),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: '영수증 분석',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
