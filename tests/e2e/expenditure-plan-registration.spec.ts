import { expect, test } from '@playwright/test';

test('plan registration exposes a safe empty state without Supabase configuration', async ({
  page,
}) => {
  await page.goto('/partner/plans');
  await expect(page).toHaveURL(/\/login\?next=\/partner$/);
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
