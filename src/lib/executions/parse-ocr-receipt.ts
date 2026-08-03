import { validateReceiptDraft } from '@/lib/executions/receipt-schema';
import {
  RECEIPT_OCR_CONFIDENCE_THRESHOLD,
  type ParsedReceipt,
  type ReceiptItemDraft,
} from '@/lib/executions/types';
import type { DocumentOcrResult } from '@/lib/upstage/document-ocr';

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

const RECEIPT_FIELD_BOUNDARY =
  /[ \t]+(?=(?:상호명?|가맹점명?|사업자(?:등록)?번호|사업자No\.?|거래일시|거래일|승인일시|일시|공급가액|공급금액|부가세|세액|합계|총액|결제금액|받을금액|결제수단|지불수단|승인번호|품목|상품|merchant|business\s*(?:no|number)|date|supply|vat|total|payment|approval\s*(?:no|number))\s*[:：])/gi;

function restoreReceiptLines(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(RECEIPT_FIELD_BOUNDARY, '\n');
}

function digits(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function money(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(digits(value));
  if (!Number.isSafeInteger(parsed)) return null;
  const isNegative = /(?:^|[^\d])[-−﹣－]\s*\d/.test(value.trim());
  return isNegative ? -parsed : parsed;
}

function capture(text: string, pattern: RegExp) {
  return clean(text.match(pattern)?.[1] ?? '');
}

function normalizeDateTime(value: string) {
  if (!value) return '';
  const parts = value.match(
    /(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})(?:일)?(?:\s+(\d{1,2})[:시](\d{2}))?/,
  );
  if (!parts) return '';
  const [, year, month, day, hour = '00', minute = '00'] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}`;
}

function parseItems(text: string, confidence: number | null) {
  const items: ReceiptItemDraft[] = [];
  for (const line of text.split(/\r?\n/)) {
    const sequentialMatch = line.match(
      /^\s*(?:품목|상품)\s*[:：]\s*(.+?)\s*(?:\||,)\s*(?:수량\s*[:：]?\s*)?(\d+)\s*(?:\||,)\s*(?:금액\s*[:：]?\s*)?([-−﹣－]?[\d,]+)\s*원?\s*$/,
    );
    const reorderedMatch = line.match(
      /^\s*(?:품목|상품)\s*[:：]\s*(.+?)\s+수량\s*[:：]\s*금액\s*[:：]\s*([-−﹣－]?[\d,]+)\s*원?\s*(?:\||,)\s*(\d+)\s*(?:\||,)?\s*$/,
    );
    const match = sequentialMatch ?? reorderedMatch;
    if (!match) continue;
    const name = clean(match[1]);
    const quantity = Number(sequentialMatch ? match[2] : match[3]);
    const amount = money(sequentialMatch ? match[3] : match[2]);
    items.push({
      id: `receipt-item-${items.length + 1}`,
      name,
      quantity,
      amount,
      confidence,
      sourceText: clean(line),
      sourceName: name,
      sourceAmount: amount,
    });
  }
  return items;
}

export function parseOcrReceipt(
  ocr: DocumentOcrResult,
  processedAt: string,
): ParsedReceipt {
  const text = restoreReceiptLines(
    ocr.pages
      .map((page) => page.text)
      .join('\n')
      .slice(0, 100_000),
  );
  const confidence = ocr.pages.every((page) => page.confidence === null)
    ? null
    : Math.min(...ocr.pages.map((page) => page.confidence ?? 1));
  const merchantName = capture(
    text,
    /(?:상호명?|가맹점명?|merchant)\s*[:：]\s*([^\n\r]+)/i,
  );
  const businessNumber = digits(
    capture(
      text,
      /(?:사업자(?:등록)?번호|사업자No\.?|business\s*(?:no|number))\s*[:：]\s*([^\n\r]+)/i,
    ),
  ).slice(0, 10);
  const transactionRaw = capture(
    text,
    /(?:거래일시|거래일|승인일시|일시|date)\s*[:：]\s*([^\n\r]+)/i,
  );
  const supplyAmount = money(
    capture(text, /(?:공급가액|공급금액|supply)\s*[:：]\s*([^\n\r]+)/i),
  );
  const taxAmount = money(
    capture(text, /(?:부가세|세액|vat)\s*[:：]\s*([^\n\r]+)/i),
  );
  const totalAmount = money(
    capture(
      text,
      /(?:합계|총액|결제금액|받을금액|total)\s*[:：]\s*([^\n\r]+)/i,
    ),
  );
  const paymentMethod = capture(
    text,
    /(?:결제수단|지불수단|payment)\s*[:：]\s*([^\n\r]+)/i,
  );
  const approvalNumber = digits(
    capture(
      text,
      /(?:승인번호|approval\s*(?:no|number))\s*[:：]\s*([^\n\r]+)/i,
    ),
  ).slice(0, 40);
  const draft = {
    merchantName,
    businessNumber,
    transactionAt: normalizeDateTime(transactionRaw),
    supplyAmount,
    taxAmount,
    totalAmount,
    paymentMethod,
    approvalNumber,
    items: parseItems(text, confidence),
  };

  const issues = validateReceiptDraft(draft);
  if (confidence !== null && confidence < RECEIPT_OCR_CONFIDENCE_THRESHOLD) {
    issues.push({
      code: 'ocr_confidence_low',
      message: 'OCR 신뢰도가 낮아 원본 대조가 필요합니다.',
      path: 'pages',
    });
  }

  return {
    draft,
    issues,
    metadata: {
      provider: 'upstage',
      apiVersion: ocr.apiVersion,
      modelVersion: ocr.modelVersion,
      processedAt,
      pageCount: ocr.pages.length,
    },
    pages: ocr.pages,
  };
}

export function receiptSemanticKey(draft: ParsedReceipt['draft']) {
  if (
    !draft.businessNumber ||
    !draft.transactionAt ||
    draft.totalAmount === null
  ) {
    return '';
  }
  const approval = draft.approvalNumber || 'no-approval';
  return [
    draft.businessNumber,
    draft.transactionAt,
    String(draft.totalAmount),
    approval,
  ].join(':');
}
