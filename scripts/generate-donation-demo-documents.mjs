import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const outputDirectory = path.resolve('public/demo-documents');
const previewDirectory = process.env.DONATION_DEMO_PREVIEW_DIR?.trim();

const baseStyles = `
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    color: #1f2937;
    background: #ffffff;
    font-family: "Malgun Gothic", "Noto Sans KR", Arial, sans-serif;
    line-height: 1.55;
  }
  .document { width: 100%; }
  .eyebrow {
    color: #0f766e;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }
  h1 { margin: 8px 0 28px; font-size: 28px; line-height: 1.3; }
  h2 { margin: 28px 0 12px; font-size: 17px; }
  .meta {
    display: grid;
    grid-template-columns: 130px 1fr;
    border-top: 2px solid #134e4a;
  }
  .meta dt, .meta dd {
    margin: 0;
    padding: 11px 12px;
    border-bottom: 1px solid #d1d5db;
  }
  .meta dt { background: #f0fdfa; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 10px; border: 1px solid #d1d5db; }
  th { background: #f0fdfa; text-align: left; }
  .amount { text-align: right; white-space: nowrap; }
  .total { font-size: 17px; font-weight: 800; }
  .notice {
    margin-top: 30px;
    padding: 13px 15px;
    border: 1px solid #f59e0b;
    background: #fffbeb;
    color: #92400e;
    font-size: 11px;
  }
  .signature { margin-top: 44px; text-align: right; }
`;

const planHtml = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      ${baseStyles}
      body { padding: 22mm 20mm; }
      .issuer { margin: -18px 0 22px; color: #4b5563; }
      .ocr-block { margin-top: 22px; border-top: 2px solid #134e4a; }
      .plan-line {
        padding: 13px 12px;
        border-bottom: 1px solid #d1d5db;
        font-size: 15px;
        white-space: nowrap;
      }
      .plan-line strong { display: inline-block; min-width: 120px; }
      .plan-line.item {
        background: #f8fafc;
        font-size: 14px;
      }
      .plan-line.total {
        background: #f0fdfa;
        font-size: 17px;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <main class="document">
      <h1>기부금 집행 계획서</h1>
      <p class="issuer">해봄 아동지원센터 · 취약계층 아동 방학 급식 지원</p>
      <p class="notice">
        본 문서는 서비스 시연을 위해 생성한 mock 계획서이며 실제 기부금 집행의
        근거로 사용할 수 없습니다.
      </p>

      <section class="ocr-block" aria-label="OCR 등록 정보">
        <div class="plan-line"><strong>계획명:</strong> 2026년 8월 아동 급식 지원 계획</div>
        <div class="plan-line"><strong>집행 기간:</strong> 2026-08-01 ~ 2026-08-31</div>
        <div class="plan-line item">항목명: 급식 식재료　사용 목적: 쌀, 채소, 과일 및 단백질 식재료 구매　계획 금액: 1,500,000원</div>
        <div class="plan-line item">항목명: 도시락 용기　사용 목적: 친환경 도시락 용기 및 포장재 구매　계획 금액: 900,000원</div>
        <div class="plan-line item">항목명: 급식 배송비　사용 목적: 지원 가정 대상 도시락 배송　계획 금액: 600,000원</div>
        <div class="plan-line total">총 계획 예산: 3,000,000원</div>
      </section>
    </main>
  </body>
</html>`;

const receiptHtml = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <style>
      ${baseStyles}
      body { padding: 18mm; background: #f3f4f6; }
      .receipt {
        width: 100%;
        min-height: 240mm;
        padding: 18mm 16mm;
        border: 1px solid #9ca3af;
        background: #ffffff;
      }
      .receipt-header { text-align: center; }
      .receipt-header h1 { margin-bottom: 8px; font-size: 25px; }
      .receipt-header p { margin: 0; color: #6b7280; font-size: 12px; }
      .receipt .notice { margin-top: 24px; }
      .ocr-block { margin-top: 24px; border-top: 2px solid #111827; }
      .ocr-line {
        padding: 10px 8px;
        border-bottom: 1px dashed #d1d5db;
        font-size: 13px;
      }
      .ocr-line strong { display: inline-block; min-width: 145px; }
      .ocr-line.item { font-family: Consolas, "Malgun Gothic", monospace; }
      .ocr-line.grand-total { font-size: 20px; font-weight: 800; }
    </style>
  </head>
  <body>
    <main class="receipt">
      <header class="receipt-header">
        <p class="eyebrow">DEMO RECEIPT</p>
        <h1>해봄마트</h1>
        <p>기부 집행 내역 등록용 시연 영수증</p>
      </header>

      <p class="notice">
        본 영수증은 서비스 시연을 위해 생성한 mock 문서이며 실제 거래·결제 또는
        세무 증빙의 효력이 없습니다. 표시된 사업자등록번호와 승인번호는 가상
        데이터입니다.
      </p>

      <section class="ocr-block" aria-label="OCR 등록 정보">
        <div class="ocr-line"><strong>상호명:</strong> 해봄마트</div>
        <div class="ocr-line"><strong>사업자등록번호:</strong> 123-45-67891</div>
        <div class="ocr-line"><strong>거래일시:</strong> 2026-08-12 14:30</div>
        <div class="ocr-line"><strong>결제수단:</strong> 법인카드</div>
        <div class="ocr-line"><strong>승인번호:</strong> 26081201</div>
        <div class="ocr-line item">품목: 쌀 및 곡류 | 수량: 1 | 금액: 180,000원</div>
        <div class="ocr-line item">품목: 채소 및 과일 | 수량: 1 | 금액: 148,000원</div>
        <div class="ocr-line item">품목: 단백질 식재료 | 수량: 1 | 금액: 100,000원</div>
        <div class="ocr-line"><strong>공급가액:</strong> 389,091원</div>
        <div class="ocr-line"><strong>부가세:</strong> 38,909원</div>
        <div class="ocr-line grand-total"><strong>합계:</strong> 428,000원</div>
      </section>
    </main>
  </body>
</html>`;

async function renderPdf(page, name, html) {
  await page.setContent(html, { waitUntil: 'load' });
  if (previewDirectory) {
    await page.screenshot({
      path: path.join(previewDirectory, name.replace(/\.pdf$/, '.png')),
      fullPage: true,
    });
  }
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: path.join(outputDirectory, name),
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
}

await mkdir(outputDirectory, { recursive: true });
if (previewDirectory) await mkdir(previewDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await renderPdf(page, '2026-08-child-meal-expenditure-plan.pdf', planHtml);
  await renderPdf(page, '2026-08-haebom-mart-receipt.pdf', receiptHtml);
} finally {
  await browser.close();
}

console.log(`Generated demo PDFs in ${outputDirectory}`);
