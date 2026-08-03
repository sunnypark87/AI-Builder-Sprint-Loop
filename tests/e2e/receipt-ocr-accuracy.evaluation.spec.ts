import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { parseOcrReceipt } from '@/lib/executions/parse-ocr-receipt';
import { recognizeDocument } from '@/lib/upstage/document-ocr';

type ExpectedReceipt = {
  merchantName: string;
  businessNumber: string;
  transactionAt: string;
  totalAmount: number;
};

type ReceiptSample = {
  name: string;
  width: number;
  height: number;
  css: string;
  body: string;
  expected: ExpectedReceipt;
};

const samples: ReceiptSample[] = [
  {
    name: 'standard-grocery',
    width: 700,
    height: 900,
    css: 'main{padding:64px;line-height:1.8}p{border-bottom:1px dashed #aaa}',
    body: `<h1>영수증</h1><p>상호명: 모두마트</p><p>사업자등록번호: 120-81-55297</p>
      <p>거래일시: 2026.08.02 14:30</p><p>품목: 식재료 | 수량 1 | 금액 100,000원</p>
      <p>공급가액: 90,909원</p><p>부가세: 9,091원</p><p>합계: 100,000원</p>`,
    expected: {
      merchantName: '모두마트',
      businessNumber: '1208155297',
      transactionAt: '2026-08-02T14:30',
      totalAmount: 100000,
    },
  },
  {
    name: 'compact-stationery',
    width: 620,
    height: 760,
    css: 'main{padding:42px;line-height:1.3}.summary{border:2px solid #222;padding:14px}',
    body: `<header><h2>햇살문구 결제전표</h2><p>승인일시: 2026-08-03 09:05</p></header>
      <section><p>가맹점명: 햇살문구</p><p>사업자번호: 214-87-12345</p>
      <p>상품: 노트 | 3 | 15,000원</p><p>상품: 연필 | 2 | 600원</p></section>
      <section class="summary"><p>세액: 4,145원</p><p>총액: 45,600원</p></section>`,
    expected: {
      merchantName: '햇살문구',
      businessNumber: '2148712345',
      transactionAt: '2026-08-03T09:05',
      totalAmount: 45600,
    },
  },
  {
    name: 'english-label-cafe',
    width: 760,
    height: 820,
    css: 'main{padding:58px}table{width:100%;border-collapse:collapse}td{padding:12px;border:1px solid #777}',
    body: `<h1>GREEN CAFE</h1><table>
      <tr><td>merchant: 그린카페</td><td>business number: 101-12-34567</td></tr>
      <tr><td>date: 2026/08/04 18:42</td><td>payment: CARD</td></tr>
      <tr><td>supply: 11,364</td><td>vat: 1,136</td></tr>
      <tr><td colspan="2">total: 12,500</td></tr></table>`,
    expected: {
      merchantName: '그린카페',
      businessNumber: '1011234567',
      transactionAt: '2026-08-04T18:42',
      totalAmount: 12500,
    },
  },
  {
    name: 'korean-date-pharmacy',
    width: 680,
    height: 880,
    css: 'main{padding:70px;line-height:1.65}.amount{font-size:30px;font-weight:700}',
    body: `<h1>온기약국</h1><p>거래일: 2026년 8월 5일 11:07</p>
      <p>사업자등록번호: 305-98-76543</p><p>상호: 온기약국</p>
      <p>품목: 구급용품, 수량 1, 금액 32,700원</p>
      <p>공급금액: 29,727원</p><p>부가세: 2,973원</p>
      <p class="amount">결제금액: 32,700원</p>`,
    expected: {
      merchantName: '온기약국',
      businessNumber: '3059876543',
      transactionAt: '2026-08-05T11:07',
      totalAmount: 32700,
    },
  },
  {
    name: 'two-column-bookstore',
    width: 800,
    height: 780,
    css: 'main{padding:52px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:28px}.total{border-top:3px double #111}',
    body: `<h2>도서 구입 영수증</h2><div class="columns">
      <section><p>가맹점: 바른서점</p><p>사업자No.: 119-86-43210</p><p>일시: 2026.08.06 16:20</p></section>
      <section><p>품목: 아동도서 | 수량 4 | 금액 64,000원</p><p>품목: 학습지 | 수량 1 | 금액 14,400원</p></section>
      </div><p class="total">받을금액: 78,400원</p>`,
    expected: {
      merchantName: '바른서점',
      businessNumber: '1198643210',
      transactionAt: '2026-08-06T16:20',
      totalAmount: 78400,
    },
  },
  {
    name: 'low-contrast-wholesale',
    width: 720,
    height: 920,
    css: 'main{padding:68px;color:#444;filter:blur(.25px);line-height:1.55}.box{border:2px solid #777;padding:18px}',
    body: `<h1>거래 영수증</h1><div class="box"><p>사업자번호: 220-12-34567</p>
      <p>상호명: 새벽식품</p><p>거래일시: 2026-08-07 07:15</p></div>
      <p>상품: 채소상자 | 10 | 180,000원</p><p>상품: 과일상자 | 5 | 50,000원</p>
      <p>공급가액: 209,091원</p><p>세액: 20,909원</p><p>합계: 230,000원</p>`,
    expected: {
      merchantName: '새벽식품',
      businessNumber: '2201234567',
      transactionAt: '2026-08-07T07:15',
      totalAmount: 230000,
    },
  },
  {
    name: 'large-number-hardware',
    width: 660,
    height: 840,
    css: 'main{padding:46px;line-height:1.45}h1{text-align:center}.total{font-size:28px;background:#eee;padding:16px}',
    body: `<h1>희망철물</h1><p>사업자 등록 번호</p><p>사업자등록번호: 312-45-67890</p>
      <p>상호명: 희망철물</p><p>승인일시: 2026/8/8 13:09</p>
      <p>품목: 보수자재 | 수량 12 | 금액 154,320원</p>
      <p>지불수단: 법인카드</p><p class="total">총액: 154,320원</p>`,
    expected: {
      merchantName: '희망철물',
      businessNumber: '3124567890',
      transactionAt: '2026-08-08T13:09',
      totalAmount: 154320,
    },
  },
  {
    name: 'minimal-convenience',
    width: 580,
    height: 720,
    css: 'main{padding:38px;font-size:22px;line-height:1.25;border:12px solid #222}.spacer{height:36px}',
    body: `<h3>나눔상회</h3><p>date: 2026년 8월 9일 20:01</p><div class="spacer"></div>
      <p>merchant: 나눔상회</p><p>business no: 410-87-65432</p>
      <p>상품: 생수 | 6 | 9,990원</p><p>payment: 현금</p><p>total: 9,990원</p>`,
    expected: {
      merchantName: '나눔상회',
      businessNumber: '4108765432',
      transactionAt: '2026-08-09T20:01',
      totalAmount: 9990,
    },
  },
];

function receiptHtml(sample: ReceiptSample) {
  return `<!doctype html><html lang="ko"><style>
    body{margin:0;background:#ddd}main{box-sizing:border-box;width:${sample.width}px;min-height:${sample.height}px;
    background:#fff;color:#111;font-family:Arial,"Malgun Gothic",sans-serif;font-size:24px}
    p{margin:10px 0}${sample.css}
  </style><body><main>${sample.body}</main></body></html>`;
}

test('receipt accuracy corpus contains eight distinct layouts and expectations', () => {
  expect(samples).toHaveLength(8);
  expect(new Set(samples.map(({ body }) => body)).size).toBe(8);
  expect(
    new Set(samples.map(({ expected }) => JSON.stringify(expected))).size,
  ).toBe(8);
});

test('Upstage OCR maps all items from the demo receipt PDF', async ({}, testInfo) => {
  test.skip(!process.env.UPSTAGE_API_KEY, 'UPSTAGE_API_KEY is required.');
  const filePath = path.resolve(
    'public/demo-documents/2026-08-haebom-mart-receipt.pdf',
  );
  const file = new globalThis.File(
    [await readFile(filePath)],
    path.basename(filePath),
    { type: 'application/pdf' },
  );
  const ocr = await recognizeDocument(file);
  const parsed = parseOcrReceipt(ocr, new Date().toISOString());

  await testInfo.attach('demo-receipt-ocr-result', {
    body: JSON.stringify(
      { ocr, draft: parsed.draft, issues: parsed.issues },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  expect(parsed.draft).toMatchObject({
    merchantName: '해봄마트',
    businessNumber: '1234567891',
    transactionAt: '2026-08-12T14:30',
    supplyAmount: 2_727_273,
    taxAmount: 272_727,
    totalAmount: 3_000_000,
    paymentMethod: '법인카드',
    approvalNumber: '26081201',
  });
  expect(parsed.draft.items).toMatchObject([
    { name: '급식 식재료', quantity: 1, amount: 1_500_000 },
    { name: '도시락 용기 및 포장재', quantity: 1, amount: 900_000 },
    { name: '급식 배송비', quantity: 1, amount: 600_000 },
  ]);
  expect(parsed.issues.map((issue) => issue.code)).toEqual([
    'ocr_confidence_low',
  ]);
});

test('Upstage OCR meets receipt field accuracy thresholds on eight synthetic samples', async ({
  page,
}, testInfo) => {
  test.skip(!process.env.UPSTAGE_API_KEY, 'UPSTAGE_API_KEY is required.');
  const summaries = [];
  const mismatches: string[] = [];
  let exact = 0;
  let dateAndTotalExact = 0;

  for (const [index, sample] of samples.entries()) {
    const filePath = testInfo.outputPath(`${sample.name}.png`);
    await page.setViewportSize({ width: sample.width, height: sample.height });
    await page.setContent(receiptHtml(sample));
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
      parsed.draft.merchantName === sample.expected.merchantName,
      parsed.draft.businessNumber === sample.expected.businessNumber,
      parsed.draft.transactionAt === sample.expected.transactionAt,
      parsed.draft.totalAmount === sample.expected.totalAmount,
    ];
    const fieldNames = [
      'merchantName',
      'businessNumber',
      'transactionAt',
      'totalAmount',
    ];
    checks.forEach((passed, fieldIndex) => {
      if (!passed) mismatches.push(`${sample.name}.${fieldNames[fieldIndex]}`);
    });
    exact += checks.filter(Boolean).length;
    dateAndTotalExact += checks.slice(2).filter(Boolean).length;
    summaries.push({
      sample: index + 1,
      name: sample.name,
      expected: sample.expected,
      actual: {
        merchantName: parsed.draft.merchantName,
        businessNumber: parsed.draft.businessNumber,
        transactionAt: parsed.draft.transactionAt,
        totalAmount: parsed.draft.totalAmount,
      },
      checks,
      issues: parsed.issues.map((issue) => issue.code),
    });
  }

  const totalChecks = samples.length * 4;
  const accuracy = exact / totalChecks;
  await testInfo.attach('receipt-field-summary', {
    body: JSON.stringify(summaries, null, 2),
    contentType: 'application/json',
  });
  testInfo.annotations.push({
    type: 'accuracy',
    description: `${exact}/${totalChecks} (${(accuracy * 100).toFixed(1)}%)`,
  });
  console.info(
    `[receipt-ocr-accuracy] required fields ${exact}/${totalChecks} (${(accuracy * 100).toFixed(1)}%), date/total ${dateAndTotalExact}/${samples.length * 2}, mismatches: ${mismatches.join(', ') || 'none'}`,
  );
  expect(accuracy).toBeGreaterThanOrEqual(0.9);
  expect(dateAndTotalExact).toBe(samples.length * 2);
});
