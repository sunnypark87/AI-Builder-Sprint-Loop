import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

import { parseOcrPlan } from '@/lib/plans/parse-ocr-plan';
import { recognizePlanDocument } from '@/lib/upstage/document-ocr';

type Expected = {
  title: string;
  periodStart: string;
  periodEnd: string;
  itemAmounts: number[];
  totalAmount: number;
};

const expected: Expected = {
  title: '아동 교육 지원',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  itemAmounts: [120_000, 80_000],
  totalAmount: 200_000,
};

function documentHtml({
  table = false,
  blur = false,
  omitTitle = false,
  secondPage = false,
}: {
  table?: boolean;
  blur?: boolean;
  omitTitle?: boolean;
  secondPage?: boolean;
} = {}) {
  const content = secondPage
    ? `<p>교재비 | 국어·수학 교재 120,000원</p>
       <p>간식비 | 교육 간식 80,000원</p>
       <p>총 계획 예산 200,000원</p>`
    : `${omitTitle ? '' : '<p>계획명: 아동 교육 지원</p>'}
       <p>집행 기간: 2026-08-01 ~ 2026-08-31</p>
       ${
         table
           ? `<table><tr><th>항목</th><th>설명</th><th>금액</th></tr>
                <tr><td>교재비</td><td>국어·수학 교재</td><td>120,000원</td></tr>
                <tr><td>간식비</td><td>교육 간식</td><td>80,000원</td></tr></table>
              <p>총 계획 예산 200,000원</p>`
           : `<p>교재비 | 국어·수학 교재 120,000원</p>
              <p>간식비 | 교육 간식 80,000원</p>
              <p>총 계획 예산 200,000원</p>`
       }`;

  return `<!doctype html><html lang="ko"><style>
    body { margin: 0; background: #eee; }
    main { box-sizing: border-box; width: 794px; min-height: 1123px; padding: 72px;
      background: white; color: #111; font-family: Arial, "Malgun Gothic", sans-serif;
      font-size: 24px; line-height: 1.8; filter: ${blur ? 'blur(0.7px)' : 'none'}; }
    h1 { font-size: 36px; } table { width: 100%; border-collapse: collapse; }
    th, td { border: 2px solid #333; padding: 12px; text-align: left; }
  </style><body><main><h1>기부 집행 계획서</h1>${content}</main></body></html>`;
}

async function screenshot(
  page: import('@playwright/test').Page,
  outputPath: string,
  html: string,
  type: 'png' | 'jpeg' = 'png',
) {
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.setContent(html);
  await page.screenshot({
    path: outputPath,
    type,
    fullPage: true,
    ...(type === 'jpeg' ? { quality: 72 } : {}),
  });
}

async function asFile(filePath: string, type: string) {
  return new globalThis.File(
    [await readFile(filePath)],
    path.basename(filePath),
    { type },
  );
}

test('Upstage OCR maps every item from the demo plan PDF', async ({}, testInfo) => {
  test.skip(!process.env.UPSTAGE_API_KEY, 'UPSTAGE_API_KEY is required.');
  const filePath = path.resolve(
    'public/demo-documents/2026-08-child-meal-expenditure-plan.pdf',
  );
  const ocr = await recognizePlanDocument(
    await asFile(filePath, 'application/pdf'),
  );
  const parsed = parseOcrPlan(ocr);

  await testInfo.attach('demo-plan-ocr-result', {
    body: JSON.stringify(
      { ocr, draft: parsed.draft, issues: parsed.issues },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(parsed.draft).toMatchObject({
    title: '2026년 8월 아동 급식 지원 계획',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    totalAmount: 3_000_000,
    items: [
      {
        name: '아동 급식 지원',
        description: '방학 급식 식재료·포장재 구매 및 지원 가정 배송',
        amount: 3_000_000,
      },
    ],
  });
  expect(parsed.issues).toEqual([]);
});

test('Upstage OCR meets the representative plan field accuracy threshold', async ({
  page,
}, testInfo) => {
  test.skip(!process.env.UPSTAGE_API_KEY, 'UPSTAGE_API_KEY is required.');

  const printed = testInfo.outputPath('printed.png');
  const scanned = testInfo.outputPath('scanned.jpg');
  const table = testInfo.outputPath('table.png');
  const blurred = testInfo.outputPath('blurred.png');
  const missing = testInfo.outputPath('missing-title.png');
  const pageOne = testInfo.outputPath('page-one.png');
  const pageTwo = testInfo.outputPath('page-two.png');
  const multiPage = testInfo.outputPath('multi-page.pdf');

  await screenshot(page, printed, documentHtml());
  await screenshot(page, scanned, documentHtml(), 'jpeg');
  await screenshot(page, table, documentHtml({ table: true }));
  await screenshot(page, blurred, documentHtml({ blur: true }));
  await screenshot(page, missing, documentHtml({ omitTitle: true }));
  await screenshot(
    page,
    pageOne,
    documentHtml().replace(
      /<p>교재비[\s\S]*?<p>총 계획 예산 200,000원<\/p>/,
      '',
    ),
  );
  await screenshot(page, pageTwo, documentHtml({ secondPage: true }));

  const pdf = await PDFDocument.create();
  for (const source of [pageOne, pageTwo]) {
    const image = await pdf.embedPng(await readFile(source));
    const pdfPage = pdf.addPage([image.width, image.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }
  await writeFile(multiPage, await pdf.save());

  const samples = [
    { name: 'printed', file: await asFile(printed, 'image/png'), expected },
    { name: 'scanned', file: await asFile(scanned, 'image/jpeg'), expected },
    { name: 'table', file: await asFile(table, 'image/png'), expected },
    {
      name: 'multi-page',
      file: await asFile(multiPage, 'application/pdf'),
      expected,
    },
    { name: 'blurred', file: await asFile(blurred, 'image/png'), expected },
    {
      name: 'missing-title',
      file: await asFile(missing, 'image/png'),
      expected: { ...expected, title: '' },
    },
  ];

  let exactRequiredFields = 0;
  let requiredFieldCount = 0;
  const summaries = [];

  for (const sample of samples) {
    const parsed = parseOcrPlan(await recognizePlanDocument(sample.file));
    const actualAmounts = parsed.draft.items.map((item) => item.amount);
    const checks = [
      parsed.draft.periodStart === sample.expected.periodStart,
      parsed.draft.periodEnd === sample.expected.periodEnd,
      ...sample.expected.itemAmounts.map(
        (amount, index) => actualAmounts[index] === amount,
      ),
      parsed.draft.totalAmount === sample.expected.totalAmount,
    ];
    exactRequiredFields += checks.filter(Boolean).length;
    requiredFieldCount += checks.length;
    summaries.push({
      name: sample.name,
      title: parsed.draft.title,
      periodStart: parsed.draft.periodStart,
      periodEnd: parsed.draft.periodEnd,
      itemAmounts: actualAmounts,
      totalAmount: parsed.draft.totalAmount,
      issues: parsed.issues.map((issue) => issue.code),
    });

    expect(parsed.draft.title, sample.name).toBe(sample.expected.title);
    if (sample.name === 'missing-title') {
      expect(parsed.issues.map((issue) => issue.code)).toContain(
        'title_required',
      );
    }
  }

  const accuracy = exactRequiredFields / requiredFieldCount;
  testInfo.annotations.push({
    type: 'accuracy',
    description: `${exactRequiredFields}/${requiredFieldCount} (${(
      accuracy * 100
    ).toFixed(1)}%)`,
  });
  await testInfo.attach('field-summary', {
    body: JSON.stringify(summaries, null, 2),
    contentType: 'application/json',
  });
  expect(accuracy).toBeGreaterThanOrEqual(0.9);
});
