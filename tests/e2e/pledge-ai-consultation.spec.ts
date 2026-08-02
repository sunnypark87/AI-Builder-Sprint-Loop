import { expect, test } from '@playwright/test';

test('AI pledge helper sends a response and changes suggestions for the next field', async ({
  page,
}) => {
  await page.route('/api/pledges', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ pledgeId: 'pledge-e2e-1' }),
      status: 201,
    });
  });
  await page.route('/api/pledges/pledge-e2e-1/chat', async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { message?: string };
    expect(body.message).toBe('5만원을 기부할게요');
    expect(request.headers()['idempotency-key']).toBeTruthy();
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        userMessage: {
          content: body.message,
          role: 'user',
        },
        assistantMessage: {
          content: '기부 금액을 약정서에 작성했어요. 기부 유형을 알려주세요.',
          role: 'assistant',
        },
        appliedPatch: { amount: 50000 },
        missingFields: [
          'donationDesignation',
          'paymentSchedule',
          'paymentMethod',
        ],
        nextQuestionField: 'donationDesignation',
      }),
      status: 200,
    });
  });

  await page.goto('/donate/green-tomorrow/consultation');
  await page.waitForLoadState('networkidle');
  await expect(
    page.getByRole('button', { name: '5만원을 기부할게요' }),
  ).toBeVisible();
  const messageBox = page.getByRole('textbox', {
    name: 'AI에게 메시지 보내기',
  });
  await messageBox.pressSequentially('5만원을 기부할게요');
  await expect(messageBox).toHaveValue('5만원을 기부할게요');
  await page.getByRole('button', { name: '보내기' }).click();

  await expect(
    page.getByText('기부 금액을 약정서에 작성했어요. 기부 유형을 알려주세요.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '지정 기부로 할게요', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '5만원을 기부할게요', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveAttribute(
    'aria-label',
    '약정 내용 완성도 25%',
  );
});
