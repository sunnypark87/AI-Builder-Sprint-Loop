import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { parseOcrReceipt } from '@/lib/executions/parse-ocr-receipt';
import { recognizeDocument } from '@/lib/upstage/document-ocr';

const expected = {
  merchantName: '모두마트',
  businessNumber: '1208155297',
  transactionAt: '2026-08-02T14:30',
  totalAmount: 100000,
};

function receiptHtml(variant: number) {
  const blur = variant === 3 ? 'filter:blur(0.45px);' : '';
  const compact = variant === 4 ? 'line-height:1.25' : 'line-height:1.8';
  const border = variant >= 5 ? 'border:2px solid #222' : '';
  return `<!doctype html><html lang="ko"><style>
    body{margin:0;background:#eee} main{box-sizing:border-box;width:700px;min-height:900px;
    padding:${variant % 2 ? 54 : 72}px;background:white;color:#111;font-family:Arial,"Malgun Gothic",sans-serif;
    font-size:${variant === 2 ? 20 : 25}px;${compact};${blur}}
    p{padding:6px;${border}}
  </style><body><main>
    <h1>영수증</h1><p>상호명: 모두마트</p><p>사업자등록번호: 120-81-55297</p>
    <p>거래일시: 2026.08.02 14:30</p><p>품목: 식재료 | 수량 1 | 금액 100,000원</p>
    <p>공급가액: 90,909원</p><p>부가세: 9,091원</p><p>합계: 100,000원</p>
    <p>결제수단: 카드</p><p>승인번호: 12345678</p>
  </main></body></html>`;
}

test('Upstage OCR meets receipt field accuracy thresholds on eight synthetic samples', async ({
  page,
}, testInfo) => {
  test.skip(!process.env.UPSTAGE_API_KEY, 'UPSTAGE_API_KEY is required.');
  const summaries = [];
  let exact = 0;
  let dateAndTotalExact = 0;

  for (let index = 0; index < 8; index += 1) {
    const filePath = testInfo.outputPath(`receipt-${index + 1}.png`);
    await page.setViewportSize({ width: 700, height: 900 });
    await page.setContent(receiptHtml(index));
    await page.screenshot({ path: filePath, fullPage: true });
    const file = new globalThis.File(
      [await readFile(filePath)],
      path.basename(filePath),
      { type: 'image/png' },
    );
    const parsed = parseOcrReceipt(
      await recognizeDocument(file),
      new Date().toISOString(),
    );
    const checks = [
      parsed.draft.merchantName === expected.merchantName,
      parsed.draft.businessNumber === expected.businessNumber,
      parsed.draft.transactionAt === expected.transactionAt,
      parsed.draft.totalAmount === expected.totalAmount,
    ];
    exact += checks.filter(Boolean).length;
    dateAndTotalExact += checks.slice(2).filter(Boolean).length;
    summaries.push({
      sample: index + 1,
      merchantName: parsed.draft.merchantName,
      businessNumber: parsed.draft.businessNumber,
      transactionAt: parsed.draft.transactionAt,
      totalAmount: parsed.draft.totalAmount,
      issues: parsed.issues.map((issue) => issue.code),
    });
  }

  const accuracy = exact / 32;
  await testInfo.attach('receipt-field-summary', {
    body: JSON.stringify(summaries, null, 2),
    contentType: 'application/json',
  });
  testInfo.annotations.push({
    type: 'accuracy',
    description: `${exact}/32 (${(accuracy * 100).toFixed(1)}%)`,
  });
  expect(accuracy).toBeGreaterThanOrEqual(0.9);
  expect(dateAndTotalExact).toBe(16);
});
