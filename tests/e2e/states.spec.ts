import { expect, test } from '@playwright/test';

test('legacy demo signing routes guide the user to the account entry point', async ({
  page,
}) => {
  await page.goto('/pledges/demo/sign');
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole('heading', { name: '어떤 화면을 둘러볼까요?' }),
  ).toBeVisible();

  await page.goto('/pledges/demo/review');
  await expect(page).toHaveURL(/\/account$/);
});

test('consultation requires authentication before showing donor guidance', async ({
  page,
}) => {
  await page.goto('/donate/green-tomorrow/consultation');

  await expect(page).toHaveURL(
    /\/login\?next=\/donate\/green-tomorrow\/consultation$/,
  );
});

test('protected donor pledge pages require authentication', async ({
  page,
}) => {
  for (const path of [
    '/my-donations',
    '/my-donations/pledge-1',
    '/pledges/pledge-1/review',
    '/pledges/pledge-1/sign',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test('protected partner screens require authentication', async ({ page }) => {
  for (const path of [
    '/partner',
    '/partner/pledges',
    '/partner/plans/demo/review',
    '/partner/register',
    '/partner/register/pledge-template',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=\/partner$/);
  }
});

test('organization directory explains an empty category and restores all results', async ({
  page,
}) => {
  await page.goto('/organizations?category=not-available');

  await expect(page.getByText('해당 분야의 기부처가 없습니다.')).toBeVisible();
  await page.getByRole('link', { name: '전체 기부처 보기' }).click();

  await expect(page).toHaveURL(/\/organizations$/);
  await expect(page.getByRole('heading', { name: '해봄재단' })).toBeVisible();
});
