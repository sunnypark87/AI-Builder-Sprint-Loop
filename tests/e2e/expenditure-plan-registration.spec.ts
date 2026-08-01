import { expect, test } from '@playwright/test';

test('plan registration exposes a safe empty state without Supabase configuration', async ({
  page,
}) => {
  await page.goto('/partner/plans');
  await page.getByRole('link', { name: '계획 등록' }).click();

  await expect(page).toHaveURL('/partner/plans/new');
  await expect(
    page.getByRole('heading', { name: '계획서를 업로드하세요' }),
  ).toBeVisible();
  await expect(
    page.getByText('등록 가능한 기부 내역이 없습니다.'),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: '대상 기부 내역' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '계획서 분석' }),
  ).toBeDisabled();
});

test('plan registration rejects a request without a document', async ({
  request,
}) => {
  const response = await request.post('/api/partner/plans', {
    data: {
      donationId: '00000000-0000-4000-8000-000000000001',
      organizationId: '00000000-0000-4000-8000-000000000002',
      idempotencyKey: 'e2e-missing-document',
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: {
      code: 'invalid_file',
    },
  });
});

test('mobile plan registration has no horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/partner/plans/new');

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(
    dimensions.viewportWidth,
  );
});
