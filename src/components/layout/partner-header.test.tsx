// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PartnerHeader } from './partner-header';

vi.mock('next/navigation', () => ({
  usePathname: () => '/partner',
}));

afterEach(cleanup);

describe('PartnerHeader', () => {
  it('does not link partner users to donor notifications', () => {
    render(<PartnerHeader />);

    expect(screen.queryByRole('link', { name: '알림' })).toBeNull();
  });
});
