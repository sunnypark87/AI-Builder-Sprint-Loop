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

  await expect(page).toHaveURL(
    /\/pledges\/demo\/waiting\?organizationId=haebom$/,
  );
});

test('pledge creation preserves the selected organization', async ({
  page,
}) => {
  await page.goto('/donate/green-tomorrow/consultation');
  await expect(
    page.getByText(
      '하천 생태계 복원과 시민 기록 활동에 매월 5만원씩 1년 동안 기부하고 싶어요.',
    ),
  ).toBeVisible();
  await page.getByRole('link', { name: '상담 요약 확인' }).click();
  await expect(
    page.getByText('하천 생태계 복원과 시민 기록 활동'),
  ).toBeVisible();
  await page.getByRole('link', { name: '약정서 생성하기' }).click();

  await expect(page.getByText('푸른내일 정기 기부 약정')).toBeVisible();
  await expect(
    page.getByText('하천 생태계 복원과 시민 기록 활동'),
  ).toBeVisible();
  await page.getByRole('link', { name: '검토 완료 · 서명하기' }).click();
  await page
    .getByRole('checkbox', {
      name: '예시 약정서 내용을 확인하고 목업 서명 진행에 동의합니다.',
    })
    .check();
  await page.getByRole('link', { name: '예시 서명 완료' }).click();

  await expect(
    page.getByRole('heading', { name: '푸른내일이 약정서를 확인하고 있어요' }),
  ).toBeVisible();

  const myDonationsLink = page.getByRole('link', {
    name: '내 기부에서 확인',
  });
  await expect(myDonationsLink).toHaveAttribute(
    'href',
    '/my-donations?organizationId=green-tomorrow',
  );
  await myDonationsLink.click();
  await expect(page.getByText('푸른내일')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: '하천 생태계 복원과 시민 기록 활동 정기 기부',
    }),
  ).toBeVisible();
  await page.goBack();

  await page
    .getByRole('link', { name: '데모: 서명 완료 후 결제 보기' })
    .click();
  await expect(
    page.getByText('하천 생태계 복원과 시민 기록 활동'),
  ).toBeVisible();
  await page.getByRole('link', { name: '예시 결제 완료' }).click();
  await expect(page.getByText('푸른내일')).toBeVisible();
  await page.getByRole('link', { name: '기부 이행 확인' }).click();
  await expect(
    page.getByRole('heading', { name: '푸른내일 기부 이행' }),
  ).toBeVisible();
  await expect(
    page.getByText('하천 생태계 복원과 시민 기록 활동 집행 계획 공개'),
  ).toBeVisible();
});

test('partner dashboard totals match filtered work lists', async ({ page }) => {
  await page.goto('/partner');

  for (const label of [
    '기부처 서명 필요',
    '계획 추출 결과 검토',
    '증빙 마스킹 확인',
    '보고서 사실 확인',
  ]) {
    const link = page.getByRole('link', { name: new RegExp(`1건.*${label}`) });
    await expect(link).toBeVisible();
  }
});

test('partner rows without matching details are not interactive', async ({
  page,
}) => {
  await page.goto('/partner/pledges');

  await expect(
    page.getByRole('link', { name: /김모아 님 · 아동 교육 정기 기부/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /이푸름 님 · 급식 지원 일시 기부/ }),
  ).toHaveCount(0);
  await expect(page.getByText('이푸름 님 · 급식 지원 일시 기부')).toBeVisible();
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
