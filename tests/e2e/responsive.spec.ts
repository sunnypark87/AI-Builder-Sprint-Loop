import { mkdir } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

const routes = [
  {
    name: 'home',
    path: '/',
    heading: '기부 이후의 이야기를 끝까지 확인하세요',
  },
  {
    name: 'organizations',
    path: '/organizations',
    heading: '기부처 찾기',
  },
  {
    name: 'pledge-review',
    path: '/pledges/demo/review',
    heading: '기부 약정서를 확인해 주세요',
  },
  { name: 'partner-dashboard', path: '/partner', heading: '기부 계약 관리' },
  {
    name: 'partner-plan-review',
    path: '/partner/plans/demo/review',
    heading: '집행 계획 항목을 확인하세요',
  },
  {
    name: 'pledge-template',
    path: '/partner/register/pledge-template',
    heading: '기부처 맞춤 약정서를 만들어 주세요',
  },
];

test.beforeAll(async () => {
  await mkdir('/tmp/modugive-responsive', { recursive: true });
});

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${viewport.name}: ${route.path} keeps core content visible without horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(route.path);

      await expect(
        page.getByRole('heading', { name: route.heading, exact: true }),
      ).toBeVisible();

      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(
        dimensions.viewportWidth,
      );

      await page.screenshot({
        fullPage: true,
        path: `/tmp/modugive-responsive/${route.name}-${viewport.width}.png`,
      });
    });
  }
}

test('mobile donor navigation and partner navigation expose their menus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/organizations');
  await page.waitForLoadState('networkidle');
  const donorMenuButton = page.getByRole('button', { name: '메뉴 열기' });
  await donorMenuButton.click();
  await expect(page.getByRole('button', { name: '메뉴 닫기' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(
    page.getByRole('navigation', { name: '모바일 주요 메뉴' }),
  ).toBeVisible();

  await page.goto('/partner');
  await page.waitForLoadState('networkidle');
  const partnerMenuButton = page.getByRole('button', {
    name: '관리 메뉴 열기',
  });
  await partnerMenuButton.click();
  await expect(
    page.getByRole('button', { name: '관리 메뉴 닫기' }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByRole('navigation', { name: '모바일 기부처 관리 메뉴' }),
  ).toBeVisible();
});
