import { describe, expect, it } from 'vitest';

import { isNavigationItemActive } from './navigation';

describe('isNavigationItemActive', () => {
  it('matches exact root navigation without matching every route', () => {
    expect(
      isNavigationItemActive('/', { label: '홈', href: '/', exact: true }),
    ).toBe(true);
    expect(
      isNavigationItemActive('/organizations', {
        label: '홈',
        href: '/',
        exact: true,
      }),
    ).toBe(false);
  });

  it('matches a section and its nested pages', () => {
    const item = { label: '기부 관리', href: '/partner/donations' };

    expect(isNavigationItemActive('/partner/donations', item)).toBe(true);
    expect(isNavigationItemActive('/partner/donations/donation-1', item)).toBe(
      true,
    );
    expect(isNavigationItemActive('/partner/pledges', item)).toBe(false);
  });
});
