// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReportCreateForm } from '@/components/partner/report-create-form';
import type { EligibleReportDonation } from '@/lib/reports/types';

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

describe('ReportCreateForm', () => {
  it('submits the selected plan when one donation has multiple plans', async () => {
    const donation = {
      organizationId: '11111111-1111-4111-8111-111111111111',
      organizationName: '테스트 기관',
      donationId: '22222222-2222-4222-8222-222222222222',
      pledgeId: '33333333-3333-4333-8333-333333333333',
      purpose: '급식 지원',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      executionCount: 1,
    };
    const donations: EligibleReportDonation[] = [
      {
        ...donation,
        planId: '44444444-4444-4444-8444-444444444441',
        planTitle: '첫 번째 계획',
      },
      {
        ...donation,
        planId: '44444444-4444-4444-8444-444444444442',
        planTitle: '두 번째 계획',
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        reportId: '55555555-5555-4555-8555-555555555555',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ReportCreateForm donations={donations} />);
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '보고 대상 기부' }),
      donations[1].planId,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'AI 보고서 초안 생성' }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      donationId: donation.donationId,
      planId: donations[1].planId,
      idempotencyKey: `report:${donation.donationId}:${donations[1].planId}:${donation.periodStart}:${donation.periodEnd}`,
    });
  });
});
