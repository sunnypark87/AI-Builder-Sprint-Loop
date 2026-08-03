// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { OrganizationPledgeCompletionPanel } from '@/components/partner/organization-pledge-completion-panel';

afterEach(cleanup);

describe('OrganizationPledgeCompletionPanel', () => {
  it('opens plan analysis only after a completed payment has a paid donation', () => {
    render(
      <OrganizationPledgeCompletionPanel
        donation={{ id: 'donation-1' }}
        payment={{ status: 'completed', updated_at: '2026-08-03T00:00:00Z' }}
      />,
    );

    expect(
      screen
        .getByRole('link', { name: '계획서 등록 및 AI 분석' })
        .getAttribute('href'),
    ).toBe('/partner/plans/new?donationId=donation-1');
  });

  it('hides plan analysis while payment or donation is incomplete', () => {
    render(
      <OrganizationPledgeCompletionPanel
        donation={null}
        payment={{ status: 'completed', updated_at: '2026-08-03T00:00:00Z' }}
      />,
    );

    expect(
      screen.queryByRole('link', { name: '계획서 등록 및 AI 분석' }),
    ).toBeNull();
  });
});
