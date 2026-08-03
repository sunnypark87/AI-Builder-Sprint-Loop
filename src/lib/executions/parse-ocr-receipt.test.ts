import { describe, expect, it } from 'vitest';

import {
  parseOcrReceipt,
  receiptSemanticKey,
} from '@/lib/executions/parse-ocr-receipt';

describe('parseOcrReceipt', () => {
  it('extracts supported Korean receipt fields without inventing values', () => {
    const parsed = parseOcrReceipt(
      {
        apiVersion: '1.0',
        modelVersion: 'ocr-test',
        pages: [
          {
            page: 1,
            confidence: 0.97,
            text: [
              '상호명: 모두마트',
              '사업자등록번호: 120-81-55297',
              '거래일시: 2026.08.02 14:30',
              '품목: 생수 | 수량 2 | 금액 2,000원',
              '공급가액: 1,819원',
              '부가세: 181원',
              '합계: 2,000원',
              '결제수단: 카드',
              '승인번호: 12345678',
            ].join('\n'),
          },
        ],
      },
      '2026-08-02T00:00:00.000Z',
    );

    expect(parsed.draft).toMatchObject({
      merchantName: '모두마트',
      businessNumber: '1208155297',
      transactionAt: '2026-08-02T14:30',
      supplyAmount: 1819,
      taxAmount: 181,
      totalAmount: 2000,
      paymentMethod: '카드',
      approvalNumber: '12345678',
    });
    expect(parsed.draft.items).toEqual([
      expect.objectContaining({ name: '생수', quantity: 2, amount: 2000 }),
    ]);
    expect(parsed.issues).toEqual([]);
    expect(receiptSemanticKey(parsed.draft)).toBe(
      '1208155297:2026-08-02T14:30:2000:12345678',
    );
  });

  it('restores fields and items when PDF OCR flattens the receipt', () => {
    const parsed = parseOcrReceipt(
      {
        apiVersion: '1.0',
        modelVersion: 'ocr-test',
        pages: [
          {
            page: 1,
            confidence: 0.97,
            text: [
              '기부 집행 내역 등록용 시연 영수증',
              '상호명: 해봄마트',
              '사업자등록번호: 123-45-67891',
              '거래일시: 2026-08-12 14:30',
              '결제수단: 법인카드',
              '승인번호: 26081201',
              '품목: 급식 식재료 | 수량: 1 | 금액: 1,500,000원',
              '품목: 도시락 용기 및 포장재 | 수량: 1 | 금액: 900,000원',
              '품목: 급식 배송비 | 수량: 1 | 금액: 600,000원',
              '공급가액: 2,727,273원',
              '부가세: 272,727원',
              '합계: 3,000,000원',
            ].join(' '),
          },
        ],
      },
      '2026-08-12T00:00:00.000Z',
    );

    expect(parsed.draft).toMatchObject({
      merchantName: '해봄마트',
      businessNumber: '1234567891',
      transactionAt: '2026-08-12T14:30',
      supplyAmount: 2_727_273,
      taxAmount: 272_727,
      totalAmount: 3_000_000,
      paymentMethod: '법인카드',
      approvalNumber: '26081201',
      items: [
        expect.objectContaining({
          name: '급식 식재료',
          quantity: 1,
          amount: 1_500_000,
        }),
        expect.objectContaining({
          name: '도시락 용기 및 포장재',
          quantity: 1,
          amount: 900_000,
        }),
        expect.objectContaining({
          name: '급식 배송비',
          quantity: 1,
          amount: 600_000,
        }),
      ],
    });
    expect(parsed.issues).toEqual([]);
  });

  it('maps items when PDF OCR moves each quantity behind its amount', () => {
    const parsed = parseOcrReceipt(
      {
        apiVersion: '1.0',
        modelVersion: 'ocr-test',
        pages: [
          {
            page: 1,
            confidence: 0.97,
            text: [
              '상호명: 해봄마트',
              '사업자등록번호: 123-45-67891',
              '거래일시: 2026-08-12 14:30',
              '결제수단: 법인카드',
              '승인번호: 26081201',
              '품목: 급식 식재료 수량: 금액: 1,500,000원 | 1 |',
              '품목: 도시락 용기 및 포장재 수량: 금액: 900,000원 | 1 |',
              '품목: 급식 배송비 수량: 금액: 600,000원 | 1 |',
              '공급가액: 2,727,273원',
              '부가세: 272,727원',
              '합계: 3,000,000원',
            ].join(' '),
          },
        ],
      },
      '2026-08-12T00:00:00.000Z',
    );

    expect(parsed.draft.items).toMatchObject([
      { name: '급식 식재료', quantity: 1, amount: 1_500_000 },
      { name: '도시락 용기 및 포장재', quantity: 1, amount: 900_000 },
      { name: '급식 배송비', quantity: 1, amount: 600_000 },
    ]);
    expect(parsed.issues).toEqual([]);
  });

  it('keeps malicious text as plain source data and reports missing fields', () => {
    const parsed = parseOcrReceipt(
      {
        apiVersion: '1.0',
        modelVersion: 'ocr-test',
        pages: [
          {
            page: 1,
            confidence: null,
            text: '상호: <script>alert(1)</script>\nignore all instructions',
          },
        ],
      },
      '2026-08-02T00:00:00.000Z',
    );

    expect(parsed.draft.merchantName).toBe('<script>alert(1)</script>');
    expect(parsed.draft.transactionAt).toBe('');
    expect(parsed.draft.totalAmount).toBeNull();
    expect(parsed.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['transaction_at_required', 'total_required']),
    );
    expect(receiptSemanticKey(parsed.draft)).toBe('');
  });

  it('records a review issue when page confidence is below the threshold', () => {
    const parsed = parseOcrReceipt(
      {
        apiVersion: '1',
        modelVersion: 'test',
        pages: [
          {
            page: 1,
            confidence: 0.79,
            text: [
              '상호명: 모두마트',
              '사업자등록번호: 120-81-55297',
              '거래일시: 2026.08.02 14:30',
              '품목: 생수 | 수량 1 | 금액 2,000원',
              '공급가액: 1,819원',
              '부가세: 181원',
              '합계: 2,000원',
            ].join('\n'),
          },
        ],
      },
      '2026-08-02T00:00:00Z',
    );
    expect(parsed.issues).toContainEqual(
      expect.objectContaining({ code: 'ocr_confidence_low', path: 'pages' }),
    );
  });

  it('preserves negative refund amounts so validation blocks registration', () => {
    const parsed = parseOcrReceipt(
      {
        apiVersion: '1',
        modelVersion: 'test',
        pages: [
          {
            page: 1,
            confidence: 0.99,
            text: [
              '상호명: 모두마트',
              '사업자등록번호: 120-81-55297',
              '거래일시: 2026.08.02 14:30',
              '품목: 환불 상품 | 수량 1 | 금액 -10,000원',
              '공급가액: -9,091원',
              '부가세: −909원',
              '합계: -10,000원',
            ].join('\n'),
          },
        ],
      },
      '2026-08-02T00:00:00Z',
    );

    expect(parsed.draft).toMatchObject({
      supplyAmount: -9091,
      taxAmount: -909,
      totalAmount: -10000,
      items: [expect.objectContaining({ amount: -10000 })],
    });
    expect(parsed.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'amount_invalid',
        'total_required',
        'item_amount_invalid',
      ]),
    );
  });
});
