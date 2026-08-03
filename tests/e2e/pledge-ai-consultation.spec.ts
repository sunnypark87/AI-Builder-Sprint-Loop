import { expect, test } from '@playwright/test';

test('AI pledge consultation redirects anonymous visitors to login', async ({
  page,
}) => {
  await page.goto('/donate/green-tomorrow/consultation');
  await expect(page).toHaveURL(
    /\/login\?next=\/donate\/green-tomorrow\/consultation$/,
  );
});
