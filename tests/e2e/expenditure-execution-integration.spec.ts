import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import {
  executionIntegrationIds,
  executionIntegrationUser,
} from './expenditure-execution-integration.setup';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!url || !secretKey) throw new Error('Supabase test environment missing.');
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test('uploads, verifies and atomically registers one receipt', async ({
  page,
  request,
}, testInfo) => {
  const imagePath = testInfo.outputPath('receipt.png');
  await page.setContent(`
    <main style="width:700px;padding:48px;font-family:Arial,sans-serif">
      <h1>모두마트</h1><p>2026.08.02 14:30</p>
      <p>식재료 100,000원</p><p>합계 100,000원</p>
    </main>
  `);
  await page.screenshot({
    path: imagePath,
    clip: { x: 0, y: 0, width: 796, height: 500 },
  });

  await page.goto('/login?next=/partner/executions/new');
  await page.getByLabel('이메일').fill(executionIntegrationUser.email);
  await page.getByLabel('비밀번호').fill(executionIntegrationUser.password);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL('/partner/executions/new');
  await request.post('http://127.0.0.1:54319/control/receipt-next');
  await page.selectOption(
    'select[name="planItemId"]',
    executionIntegrationIds.planItem,
  );
  await page.getByLabel(/영수증 원본/).setInputFiles(imagePath);
  await page.getByRole('button', { name: '영수증 분석' }).click();

  await expect(page).toHaveURL(/\/partner\/executions\/[0-9a-f-]+\/review/);
  await expect(page.getByLabel('상호명')).toHaveValue('모두마트');
  await expect(page.getByLabel('합계')).toHaveValue('100000');
  await expect(page.getByText('등록 차단')).toHaveCount(0);
  await page.getByRole('button', { name: '검토 완료·내부 등록' }).click();
  await expect(page).toHaveURL('/partner/executions?status=registered');

  const supabase = adminClient();
  const { data: execution, error } = await supabase
    .from('expenditure_executions')
    .select(
      'status,total_amount,merchant_name,reviewed_by,verification_results',
    )
    .eq('organization_id', executionIntegrationIds.organization)
    .single();
  expect(error).toBeNull();
  expect(execution).toMatchObject({
    status: 'registered',
    total_amount: 100_000,
    merchant_name: '모두마트',
  });
  expect(execution?.reviewed_by).toBeTruthy();
  expect(execution?.verification_results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'remaining_budget', outcome: 'passed' }),
    ]),
  );

  await page.goto('/partner/executions/new');
  await request.post('http://127.0.0.1:54319/control/receipt-next');
  await page.selectOption(
    'select[name="planItemId"]',
    executionIntegrationIds.planItem,
  );
  await page.getByLabel(/영수증 원본/).setInputFiles(imagePath);
  await page.getByRole('button', { name: '영수증 분석' }).click();
  await expect(
    page.getByText('동일한 원본 영수증이 이미 있습니다.'),
  ).toBeVisible();

  const { count } = await supabase
    .from('expenditure_executions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', executionIntegrationIds.organization);
  expect(count).toBe(1);

  const { data: users, error: usersError } =
    await supabase.auth.admin.listUsers();
  expect(usersError).toBeNull();
  const actor = users.users.find(
    (user) => user.email === executionIntegrationUser.email,
  );
  expect(actor).toBeTruthy();

  const concurrentDrafts = await Promise.all(
    [
      { suffix: '1', fingerprint: 'b'.repeat(64) },
      { suffix: '2', fingerprint: 'c'.repeat(64) },
    ].map(async ({ suffix, fingerprint }) => {
      const approvalNumber = `CONC000${suffix}`;
      const { data: created, error: createError } = await supabase
        .rpc('create_expenditure_execution_analysis', {
          p_actor_id: actor!.id,
          p_organization_id: executionIntegrationIds.organization,
          p_donation_id: executionIntegrationIds.donation,
          p_plan_id: executionIntegrationIds.plan,
          p_plan_item_id: executionIntegrationIds.planItem,
          p_idempotency_key: `execution-concurrent-${suffix}`,
          p_source_file_name: `concurrent-${suffix}.png`,
          p_source_mime_type: 'image/png',
          p_source_size_bytes: 100,
          p_source_page_count: 1,
          p_source_fingerprint: fingerprint,
        })
        .single();
      expect(createError).toBeNull();
      const creation = created as {
        execution_id: string;
        lease_token: string;
      };
      const executionId = creation.execution_id;
      const draft = {
        merchantName: `동시마트 ${suffix}`,
        businessNumber: '1208155297',
        transactionAt: `2026-08-03T10:0${suffix}`,
        supplyAmount: 90_909,
        taxAmount: 9_091,
        totalAmount: 100_000,
        paymentMethod: '카드',
        approvalNumber,
        items: [
          {
            id: `concurrent-item-${suffix}`,
            name: '식재료',
            quantity: 1,
            amount: 100_000,
            confidence: 0.99,
            sourceText: `식재료 ${suffix}`,
            sourceName: '식재료',
            sourceAmount: 100_000,
          },
        ],
      };
      const verificationResults = [
        {
          code: 'remaining_budget',
          version: 1,
          outcome: 'passed',
          message: '예산 확인',
          evidence: '100000 / 100000',
        },
      ];
      const { error: saveError } = await supabase.rpc(
        'save_expenditure_execution_analysis',
        {
          p_actor_id: actor!.id,
          p_execution_id: executionId,
          p_lease_token: creation.lease_token,
          p_source_path: `${executionIntegrationIds.organization}/${executionId}/source.png`,
          p_draft: draft,
          p_validation_issues: [],
          p_ocr_metadata: {
            apiVersion: 'test',
            modelVersion: 'test',
            pageCount: 1,
            processedAt: '2026-08-03T00:00:00Z',
          },
          p_verification_results: verificationResults,
          p_semantic_key: `1208155297:2026-08-03T10:0${suffix}:100000:${approvalNumber}`,
        },
      );
      expect(saveError).toBeNull();
      return { executionId, draft, verificationResults };
    }),
  );

  const concurrentResults = await Promise.all(
    concurrentDrafts.map(({ executionId, draft, verificationResults }) =>
      supabase.rpc('register_expenditure_execution', {
        p_actor_id: actor!.id,
        p_execution_id: executionId,
        p_plan_item_id: executionIntegrationIds.planItem,
        p_draft: draft,
        p_verification_results: verificationResults,
        p_warning_reason: '',
      }),
    ),
  );
  expect(concurrentResults.filter(({ error }) => error === null)).toHaveLength(
    1,
  );
  expect(concurrentResults.filter(({ error }) => error !== null)).toHaveLength(
    1,
  );

  const { data: registeredRows, error: registeredError } = await supabase
    .from('expenditure_executions')
    .select('total_amount')
    .eq('organization_id', executionIntegrationIds.organization)
    .eq('status', 'registered');
  expect(registeredError).toBeNull();
  expect(registeredRows).toHaveLength(2);
  expect(
    registeredRows!.reduce((sum, row) => sum + Number(row.total_amount), 0),
  ).toBe(200_000);
});
