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
    name: 'consultation',
    path: '/donate/green-tomorrow/consultation',
    heading: '로그인',
  },
  {
    name: 'account',
    path: '/account',
    heading: '어떤 화면을 둘러볼까요?',
  },
  {
    name: 'login',
    path: '/login',
    heading: '로그인',
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
  await expect(donorMenuButton).toHaveAttribute('aria-expanded', 'false');

  await page.goto('/partner');
  await expect(page).toHaveURL(/\/login\?next=\/partner$/);
});
