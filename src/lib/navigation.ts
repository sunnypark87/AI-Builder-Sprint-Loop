export type NavigationItem = {
  label: string;
  href: string;
  description?: string;
  exact?: boolean;
};

export const donorNavigation: NavigationItem[] = [
  { label: '모두기브', href: '/', exact: true },
  { label: '기부처 찾기', href: '/organizations' },
  { label: '내 기부', href: '/my-donations' },
  { label: '알림', href: '/notifications' },
];

export const partnerNavigation: NavigationItem[] = [
  { label: '대시보드', href: '/partner', exact: true },
  { label: '약정 관리', href: '/partner/pledges' },
  { label: '기부 관리', href: '/partner/donations' },
  { label: '집행 계획', href: '/partner/plans' },
  { label: '집행 내역', href: '/partner/executions' },
  { label: '보고서', href: '/partner/reports' },
];

export function isNavigationItemActive(pathname: string, item: NavigationItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
