// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlanCreationForm } from '@/components/partner/plan-creation-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(cleanup);

describe('PlanCreationForm', () => {
  it('uses direct entry by default and offers OCR upload as an option', async () => {
    const user = userEvent.setup();
    render(<PlanCreationForm donations={[]} />);

    expect(screen.getByRole('textbox', { name: '계획명' })).toBeTruthy();
    expect(screen.queryByLabelText(/집행 계획서/)).toBeNull();

    await user.click(screen.getByRole('radio', { name: /파일로 자동 입력/ }));

    expect(screen.getByLabelText(/집행 계획서/)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '계획명' })).toBeNull();
  });

  it('preselects the donation passed from a signed pledge', () => {
    render(
      <PlanCreationForm
        donations={[
          {
            id: 'donation-1',
            organizationId: 'organization-1',
            label: '서명 완료 기부',
          },
        ]}
        initialDonationId="donation-1"
      />,
    );

    expect(
      (
        screen.getByRole('combobox', {
          name: '대상 기부 내역',
        }) as HTMLSelectElement
      ).value,
    ).toBe('donation-1');
  });
});
