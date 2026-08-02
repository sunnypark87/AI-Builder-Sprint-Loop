import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import {
  integrationIds,
  integrationUser,
} from './expenditure-plan-integration.setup';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!url || !secretKey) throw new Error('Supabase test environment missing.');
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login?next=/partner/plans/new');
  await page.getByLabel('이메일').fill(integrationUser.email);
  await page.getByLabel('비밀번호').fill(integrationUser.password);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL('/partner/plans/new');
}

async function planImage(page: import('@playwright/test').Page, path: string) {
  await page.setContent(`
    <main style="width:700px;padding:48px;font-family:Arial,sans-serif">
      <h1>기부 집행 계획서</h1>
      <p>계획명: 교육 지원</p>
      <p>집행 기간: 2026-08-01 ~ 2026-08-31</p>
      <p>교재비 | 아동 교재 구입 100,000원</p>
      <p>총 계획 예산 100,000원</p>
    </main>
  `);
  await page.screenshot({
    path,
    clip: { x: 0, y: 0, width: 796, height: 600 },
  });
}

async function uploadPlan(
  page: import('@playwright/test').Page,
  imagePath: string,
) {
  await page.getByRole('radio', { name: /파일로 자동 입력/ }).check();
  await page.selectOption('select[name="donationId"]', integrationIds.donation);
  await page.getByLabel(/집행 계획서/).setInputFiles(imagePath);
  await page.getByRole('button', { name: '계획서 분석' }).click();
}

test.describe.serial('local Supabase expenditure plan flow', () => {
  test('uploads, reviews, edits, and atomically registers a plan', async ({
    page,
  }, testInfo) => {
    const imagePath = testInfo.outputPath('plan.png');
    await planImage(page, imagePath);
    await login(page);
    await uploadPlan(page, imagePath);

    await expect(page).toHaveURL(/\/partner\/plans\/[0-9a-f-]+\/review/);
    await expect(page.getByLabel('계획명')).toHaveValue('교육 지원');
    await expect(page.getByLabel('집행 시작일')).toHaveValue('2026-08-01');
    await expect(page.getByLabel('집행 종료일')).toHaveValue('2026-08-31');
    await expect(
      page.getByRole('textbox', { name: '항목 1', exact: true }),
    ).toHaveValue('교재비');
    await expect(page.getByLabel('금액')).toHaveValue('100000');
    await expect(page.getByLabel('총 계획 예산')).toHaveValue('100000');

    await page.getByLabel('계획명').fill('교육 지원 수정');
    await page.getByRole('button', { name: '검토 완료·등록' }).click();
    await expect(page).toHaveURL('/partner/plans?status=registered');

    const planId = /\/partner\/plans\/([0-9a-f-]+)\/review/.exec(
      page.url(),
    )?.[1];
    const supabase = adminClient();
    const { data: plan, error: planError } = await supabase
      .from('expenditure_plans')
      .select('id,title,status,organization_id,donation_id,reviewed_by')
      .eq('organization_id', integrationIds.organization)
      .eq('title', '교육 지원 수정')
      .single();
    expect(planError).toBeNull();
    expect(plan).toMatchObject({
      title: '교육 지원 수정',
      status: 'registered',
      organization_id: integrationIds.organization,
      donation_id: integrationIds.donation,
    });
    expect(plan?.reviewed_by).toBeTruthy();
    expect(planId ?? plan?.id).toBeTruthy();

    const { data: items, error: itemsError } = await supabase
      .from('expenditure_plan_items')
      .select('name,amount,edited_by_reviewer')
      .eq('plan_id', plan!.id);
    expect(itemsError).toBeNull();
    expect(items).toEqual([
      { name: '교재비', amount: 100_000, edited_by_reviewer: false },
    ]);
  });

  test('registers a manually entered plan without a source document', async ({
    page,
  }) => {
    await login(page);
    await page
      .getByLabel('대상 기부 내역')
      .selectOption(integrationIds.donation);
    await page
      .getByRole('textbox', { name: '계획명', exact: true })
      .fill('8월 급식 계획');
    await page.getByLabel('집행 시작일').fill('2026-08-01');
    await page.getByLabel('집행 종료일').fill('2026-08-31');
    await page
      .getByRole('textbox', { name: '항목 1', exact: true })
      .fill('식재료');
    await page.getByLabel('설명').fill('급식 재료 구입');
    await page.getByLabel('금액').fill('100000');
    await page.getByLabel('총 계획 예산').fill('100000');
    await page.getByRole('button', { name: '계획 등록' }).click();

    await expect(page).toHaveURL('/partner/plans?status=registered');

    const supabase = adminClient();
    const { data: plan, error } = await supabase
      .from('expenditure_plans')
      .select(
        'id,status,input_method,source_path,source_file_name,ocr_metadata',
      )
      .eq('organization_id', integrationIds.organization)
      .eq('title', '8월 급식 계획')
      .single();
    expect(error).toBeNull();
    expect(plan).toMatchObject({
      status: 'registered',
      input_method: 'manual',
      source_path: null,
      source_file_name: null,
      ocr_metadata: null,
    });

    const { data: items, error: itemsError } = await supabase
      .from('expenditure_plan_items')
      .select('name,description,amount,source_confidence,source_text')
      .eq('plan_id', plan!.id);
    expect(itemsError).toBeNull();
    expect(items).toEqual([
      {
        name: '식재료',
        description: '급식 재료 구입',
        amount: 100_000,
        source_confidence: null,
        source_text: '',
      },
    ]);
  });

  test('keeps a failed analysis partial-data free and retries the same source', async ({
    page,
    request,
  }, testInfo) => {
    const imagePath = testInfo.outputPath('retry-plan.png');
    await planImage(page, imagePath);
    await request.post('http://127.0.0.1:54319/control/fail-next');
    await login(page);
    await uploadPlan(page, imagePath);

    await expect(
      page.getByText('문서 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.'),
    ).toBeVisible();

    const supabase = adminClient();
    const { data: failed, error: failedError } = await supabase
      .from('expenditure_plans')
      .select('id,status,source_path,draft_data')
      .eq('organization_id', integrationIds.organization)
      .eq('status', 'analysis_failed')
      .single();
    expect(failedError).toBeNull();
    expect(failed).toMatchObject({
      status: 'analysis_failed',
      draft_data: null,
    });
    expect(failed?.source_path).toBeTruthy();

    const { count: itemCount } = await supabase
      .from('expenditure_plan_items')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', failed!.id);
    const { count: runCount } = await supabase
      .from('plan_ocr_runs')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', failed!.id);
    expect(itemCount).toBe(0);
    expect(runCount).toBe(0);

    await page.goto('/partner/plans?status=analysis_failed');
    await page.getByRole('button', { name: '재시도' }).click();
    await expect(page).toHaveURL(`/partner/plans/${failed!.id}/review`);
    await expect(page.getByLabel('계획명')).toHaveValue('교육 지원');
  });
});
