import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = Number(process.env.UPSTAGE_MOCK_PORT || 54319);
let failNext = false;
let receiptNext = false;

const ocrResponse = {
  apiVersion: '1.1',
  modelVersion: 'ocr-integration-test',
  pages: [
    {
      page: 1,
      confidence: 0.99,
      text: [
        '계획명: 교육 지원',
        '집행 기간: 2026-08-01 ~ 2026-08-31',
        '교재비 | 아동 교재 구입 100,000원',
        '총 계획 예산 100,000원',
      ].join('\n'),
    },
  ],
};

const receiptOcrResponse = {
  apiVersion: '1.1',
  modelVersion: 'ocr-integration-test',
  pages: [
    {
      page: 1,
      confidence: 0.99,
      text: [
        '상호명: 모두마트',
        '사업자등록번호: 120-81-55297',
        '거래일시: 2026.08.02 14:30',
        '품목: 식재료 | 수량 1 | 금액 100,000원',
        '공급가액: 90,909원',
        '부가세: 9,091원',
        '합계: 100,000원',
        '결제수단: 카드',
        '승인번호: 12345678',
      ].join('\n'),
    },
  ],
};

createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200).end('ok');
    return;
  }

  if (request.url === '/control/fail-next' && request.method === 'POST') {
    failNext = true;
    response.writeHead(204).end();
    return;
  }

  if (request.url === '/control/receipt-next' && request.method === 'POST') {
    receiptNext = true;
    response.writeHead(204).end();
    return;
  }

  if (
    request.url === '/v1/document-digitization' &&
    request.method === 'POST'
  ) {
    request.resume();
    if (failNext) {
      failNext = false;
      response.writeHead(429, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'rate limited' } }));
      return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify(receiptNext ? receiptOcrResponse : ocrResponse),
    );
    receiptNext = false;
    return;
  }

  response.writeHead(404).end();
}).listen(port, host);
