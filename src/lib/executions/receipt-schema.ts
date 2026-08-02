import type {
  ReceiptDraft,
  ReceiptItemDraft,
  ReceiptValidationIssue,
} from '@/lib/executions/types';

const MAX_AMOUNT = 1_000_000_000_000;
const MAX_PAYMENT_METHOD_LENGTH = 100;
const MAX_APPROVAL_NUMBER_LENGTH = 40;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function isValidLocalDateTime(value: string) {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function nullableInteger(value: unknown) {
  return value === null ||
    (typeof value === 'number' && Number.isSafeInteger(value))
    ? value
    : undefined;
}

function nullableConfidence(value: unknown) {
  return value === null ||
    (typeof value === 'number' && value >= 0 && value <= 1)
    ? value
    : undefined;
}

function parseItem(value: unknown): ReceiptItemDraft | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  const quantity = nullableInteger(value.quantity);
  const amount = nullableInteger(value.amount);
  const confidence = nullableConfidence(value.confidence);
  const sourceText = stringValue(value.sourceText);
  const sourceName = stringValue(value.sourceName);
  const sourceAmount = nullableInteger(value.sourceAmount);
  if (
    id === null ||
    name === null ||
    quantity === undefined ||
    amount === undefined ||
    confidence === undefined ||
    sourceText === null ||
    sourceName === null ||
    sourceAmount === undefined
  ) {
    return null;
  }
  return {
    id,
    name,
    quantity,
    amount,
    confidence,
    sourceText,
    sourceName,
    sourceAmount,
  };
}

function parseEditableItem(value: unknown): ReceiptItemDraft | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  const quantity = nullableInteger(value.quantity);
  const amount = nullableInteger(value.amount);
  if (
    id === null ||
    name === null ||
    quantity === undefined ||
    amount === undefined
  ) {
    return null;
  }
  return {
    id,
    name,
    quantity,
    amount,
    confidence: null,
    sourceText: '',
    sourceName: '',
    sourceAmount: null,
  };
}

export function parseReceiptDraft(value: unknown): ReceiptDraft | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const merchantName = stringValue(value.merchantName);
  const businessNumber = stringValue(value.businessNumber);
  const transactionAt = stringValue(value.transactionAt);
  const supplyAmount = nullableInteger(value.supplyAmount);
  const taxAmount = nullableInteger(value.taxAmount);
  const totalAmount = nullableInteger(value.totalAmount);
  const paymentMethod = stringValue(value.paymentMethod);
  const approvalNumber = stringValue(value.approvalNumber);
  const items = value.items.map(parseItem);
  if (
    merchantName === null ||
    businessNumber === null ||
    transactionAt === null ||
    supplyAmount === undefined ||
    taxAmount === undefined ||
    totalAmount === undefined ||
    paymentMethod === null ||
    approvalNumber === null ||
    items.some((item) => item === null)
  ) {
    return null;
  }
  return {
    merchantName,
    businessNumber,
    transactionAt,
    supplyAmount,
    taxAmount,
    totalAmount,
    paymentMethod,
    approvalNumber,
    items: items as ReceiptItemDraft[],
  };
}

export function parseEditableReceiptDraft(value: unknown): ReceiptDraft | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const merchantName = stringValue(value.merchantName);
  const businessNumber = stringValue(value.businessNumber);
  const transactionAt = stringValue(value.transactionAt);
  const supplyAmount = nullableInteger(value.supplyAmount);
  const taxAmount = nullableInteger(value.taxAmount);
  const totalAmount = nullableInteger(value.totalAmount);
  const paymentMethod = stringValue(value.paymentMethod);
  const approvalNumber = stringValue(value.approvalNumber);
  const items = value.items.map(parseEditableItem);
  if (
    merchantName === null ||
    businessNumber === null ||
    transactionAt === null ||
    supplyAmount === undefined ||
    taxAmount === undefined ||
    totalAmount === undefined ||
    paymentMethod === null ||
    approvalNumber === null ||
    items.some((item) => item === null)
  ) {
    return null;
  }
  return {
    merchantName,
    businessNumber,
    transactionAt,
    supplyAmount,
    taxAmount,
    totalAmount,
    paymentMethod,
    approvalNumber,
    items: items as ReceiptItemDraft[],
  };
}

export function mergeReceiptOcrProvenance(
  edited: ReceiptDraft,
  original: ReceiptDraft,
): ReceiptDraft | null {
  const originalItems = new Map(original.items.map((item) => [item.id, item]));
  const reviewedIds = new Set<string>();
  const items: ReceiptItemDraft[] = [];
  for (const item of edited.items) {
    if (!item.id.trim() || item.id.length > 100 || reviewedIds.has(item.id)) {
      return null;
    }
    reviewedIds.add(item.id);
    const source = originalItems.get(item.id);
    items.push({
      ...item,
      confidence: source?.confidence ?? null,
      sourceText: source?.sourceText ?? '',
      sourceName: source?.sourceName ?? '',
      sourceAmount: source?.sourceAmount ?? null,
    });
  }
  return {
    ...edited,
    items,
  };
}

function validAmount(value: number | null) {
  return (
    value === null ||
    (Number.isSafeInteger(value) && value >= 0 && value <= MAX_AMOUNT)
  );
}

export function validateReceiptDraft(draft: ReceiptDraft) {
  const issues: ReceiptValidationIssue[] = [];
  if (!draft.merchantName.trim()) {
    issues.push({
      code: 'merchant_required',
      message: '상호명을 입력해 주세요.',
      path: 'merchantName',
    });
  } else if (draft.merchantName.trim().length > 200) {
    issues.push({
      code: 'merchant_too_long',
      message: '상호명은 200자 이하로 입력해 주세요.',
      path: 'merchantName',
    });
  }

  if (!draft.transactionAt) {
    issues.push({
      code: 'transaction_at_required',
      message: '거래일시를 입력해 주세요.',
      path: 'transactionAt',
    });
  } else if (!isValidLocalDateTime(draft.transactionAt)) {
    issues.push({
      code: 'transaction_at_invalid',
      message: '거래일시 형식을 확인해 주세요.',
      path: 'transactionAt',
    });
  }

  if (draft.businessNumber && !/^\d{10}$/.test(draft.businessNumber)) {
    issues.push({
      code: 'business_number_invalid',
      message: '사업자등록번호는 숫자 10자리여야 합니다.',
      path: 'businessNumber',
    });
  }

  if (draft.paymentMethod.length > MAX_PAYMENT_METHOD_LENGTH) {
    issues.push({
      code: 'payment_method_too_long',
      message: '결제수단은 100자 이하로 입력해 주세요.',
      path: 'paymentMethod',
    });
  }
  if (draft.approvalNumber.length > MAX_APPROVAL_NUMBER_LENGTH) {
    issues.push({
      code: 'approval_number_too_long',
      message: '승인번호는 40자 이하로 입력해 주세요.',
      path: 'approvalNumber',
    });
  }

  for (const [path, amount] of [
    ['supplyAmount', draft.supplyAmount],
    ['taxAmount', draft.taxAmount],
  ] as const) {
    if (!validAmount(amount)) {
      issues.push({
        code: 'amount_invalid',
        message: '금액은 0원 이상이어야 합니다.',
        path,
      });
    }
  }
  if (
    draft.totalAmount === null ||
    !Number.isSafeInteger(draft.totalAmount) ||
    draft.totalAmount <= 0 ||
    draft.totalAmount > MAX_AMOUNT
  ) {
    issues.push({
      code: 'total_required',
      message: '합계는 1원 이상의 정수로 입력해 주세요.',
      path: 'totalAmount',
    });
  }

  if (draft.items.length > 100) {
    issues.push({
      code: 'items_too_many',
      message: '품목은 100개 이하로 입력해 주세요.',
      path: 'items',
    });
  }
  draft.items.forEach((item, index) => {
    if (!item.name.trim()) {
      issues.push({
        code: 'item_name_required',
        message: '품목명을 입력해 주세요.',
        path: `items.${index}.name`,
      });
    } else if (item.name.trim().length > 200) {
      issues.push({
        code: 'item_name_too_long',
        message: '품목명은 200자 이하로 입력해 주세요.',
        path: `items.${index}.name`,
      });
    }
    if (
      item.quantity !== null &&
      (!Number.isInteger(item.quantity) || item.quantity <= 0)
    ) {
      issues.push({
        code: 'item_quantity_invalid',
        message: '수량은 1 이상의 정수여야 합니다.',
        path: `items.${index}.quantity`,
      });
    }
    if (item.amount === null || !validAmount(item.amount)) {
      issues.push({
        code: 'item_amount_invalid',
        message: '품목 금액을 확인해 주세요.',
        path: `items.${index}.amount`,
      });
    }
  });
  return issues;
}
