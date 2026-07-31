import { expect, test } from '@playwright/test';

test('pledge signing requires consent before continuing', async ({ page }) => {
  await page.goto('/pledges/demo/sign');

  const completeButton = page.getByRole('button', { name: '예시 서명 완료' });
  await expect(completeButton).toBeDisabled();
  await expect(page.getByRole('link', { name: '예시 서명 완료' })).toHaveCount(
    0,
  );

  await page
    .getByRole('checkbox', {
      name: '예시 약정서 내용을 확인하고 목업 서명 진행에 동의합니다.',
    })
    .check();
  await page.getByRole('link', { name: '예시 서명 완료' }).click();

  await expect(page).toHaveURL(/\/pledges\/demo\/waiting$/);
});

test('organization registration blocks submission and focuses the missing required field', async ({
  page,
}) => {
  await page.goto('/partner/register');

  const organizationName = page.getByRole('textbox', { name: '기부처명' });
  await organizationName.clear();
  await expect(
    page.getByRole('link', { name: '2. 약정서 템플릿' }),
  ).toHaveCount(0);
  await expect(page.getByText('2. 약정서 템플릿')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('button', { name: '저장하고 약정서 만들기' }).click();

  await expect(page).toHaveURL(/\/partner\/register$/);
  await expect(organizationName).toBeFocused();
  expect(
    await organizationName.evaluate((input: HTMLInputElement) => ({
      valid: input.checkValidity(),
      validationMessage: input.validationMessage,
    })),
  ).toEqual({
    valid: false,
    validationMessage: expect.stringMatching(/.+/),
  });
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

test('partner list explains an empty status and resets the filter', async ({
  page,
}) => {
  await page.goto('/partner/pledges?status=revision');

  await expect(page.getByText('해당 상태의 업무가 없습니다.')).toBeVisible();
  await expect(page.getByText('0건')).toBeVisible();
  await page.getByRole('link', { name: '필터 초기화' }).click();

  await expect(page).toHaveURL(/\/partner\/pledges$/);
  await expect(page.getByText('김모아 님 · 아동 교육 정기 기부')).toBeVisible();
});
