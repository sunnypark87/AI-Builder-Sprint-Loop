import type { PlanDraft, PlanValidationIssue } from '@/lib/plans/types';

const MAX_MONEY = 1_000_000_000_000;
const MAX_TITLE_LENGTH = 200;
const MAX_ITEMS = 100;
const MAX_ITEM_NAME_LENGTH = 200;
const MAX_ITEM_DESCRIPTION_LENGTH = 1000;

function isValidMoney(value: number | null) {
  return (
    value !== null &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_MONEY
  );
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableNumber(value: unknown) {
  return value === null || typeof value === 'number' ? value : undefined;
}

export function parsePlanDraft(value: unknown): PlanDraft | null {
  if (
    !isRecord(value) ||
    typeof value.title !== 'string' ||
    typeof value.periodStart !== 'string' ||
    typeof value.periodEnd !== 'string' ||
    nullableNumber(value.totalAmount) === undefined ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  const items = value.items.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      typeof item.name !== 'string' ||
      typeof item.description !== 'string' ||
      nullableNumber(item.amount) === undefined ||
      nullableNumber(item.confidence) === undefined ||
      typeof item.sourceText !== 'string' ||
      typeof item.sourceName !== 'string' ||
      nullableNumber(item.sourceAmount) === undefined
    ) {
      return null;
    }

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      amount: item.amount as number | null,
      confidence: item.confidence as number | null,
      sourceText: item.sourceText,
      sourceName: item.sourceName,
      sourceAmount: item.sourceAmount as number | null,
    };
  });

  if (items.some((item) => item === null)) {
    return null;
  }

  return {
    title: value.title,
    periodStart: value.periodStart,
    periodEnd: value.periodEnd,
    totalAmount: value.totalAmount as number | null,
    items: items as PlanDraft['items'],
  };
}

export function validatePlanDraft(draft: PlanDraft): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];

  if (!draft.title.trim()) {
    issues.push({
      code: 'title_required',
      message: '계획명을 입력해 주세요.',
      path: 'title',
    });
  }

  if (draft.title.trim().length > MAX_TITLE_LENGTH) {
    issues.push({
      code: 'title_too_long',
      message: `계획명은 ${MAX_TITLE_LENGTH}자 이하로 입력해 주세요.`,
      path: 'title',
    });
  }

  if (!draft.periodStart) {
    issues.push({
      code: 'period_start_required',
      message: '집행 시작일을 입력해 주세요.',
      path: 'periodStart',
    });
  }

  if (!draft.periodEnd) {
    issues.push({
      code: 'period_end_required',
      message: '집행 종료일을 입력해 주세요.',
      path: 'periodEnd',
    });
  }

  if (
    draft.periodStart &&
    draft.periodEnd &&
    (!isValidDate(draft.periodStart) ||
      !isValidDate(draft.periodEnd) ||
      draft.periodStart > draft.periodEnd)
  ) {
    issues.push({
      code: 'period_invalid',
      message: '집행 기간의 날짜와 순서를 확인해 주세요.',
      path: 'periodEnd',
    });
  }

  if (draft.items.length === 0) {
    issues.push({
      code: 'items_required',
      message: '예산 항목을 한 개 이상 입력해 주세요.',
      path: 'items',
    });
  }

  if (draft.items.length > MAX_ITEMS) {
    issues.push({
      code: 'items_too_many',
      message: `예산 항목은 ${MAX_ITEMS}개 이하로 입력해 주세요.`,
      path: 'items',
    });
  }

  const itemIds = new Set<string>();
  draft.items.forEach((item, index) => {
    if (itemIds.has(item.id)) {
      issues.push({
        code: 'item_id_duplicate',
        message: '중복된 예산 항목을 제거해 주세요.',
        path: `items.${index}.name`,
      });
    }
    itemIds.add(item.id);
  });

  draft.items.forEach((item, index) => {
    if (!item.name.trim()) {
      issues.push({
        code: 'item_name_required',
        message: '예산 항목명을 입력해 주세요.',
        path: `items.${index}.name`,
      });
    }

    if (item.name.trim().length > MAX_ITEM_NAME_LENGTH) {
      issues.push({
        code: 'item_name_too_long',
        message: `예산 항목명은 ${MAX_ITEM_NAME_LENGTH}자 이하로 입력해 주세요.`,
        path: `items.${index}.name`,
      });
    }

    if (item.description.length > MAX_ITEM_DESCRIPTION_LENGTH) {
      issues.push({
        code: 'item_description_too_long',
        message: `설명은 ${MAX_ITEM_DESCRIPTION_LENGTH}자 이하로 입력해 주세요.`,
        path: `items.${index}.description`,
      });
    }

    if (!isValidMoney(item.amount)) {
      issues.push({
        code: 'item_amount_invalid',
        message: '예산 금액은 0보다 큰 원 단위 정수여야 합니다.',
        path: `items.${index}.amount`,
      });
    }
  });

  if (!isValidMoney(draft.totalAmount)) {
    issues.push({
      code: 'total_amount_required',
      message: '총 계획 예산을 확인해 주세요.',
      path: 'totalAmount',
    });
  }

  if (
    isValidMoney(draft.totalAmount) &&
    draft.items.length > 0 &&
    draft.items.every((item) => isValidMoney(item.amount))
  ) {
    const itemTotal = draft.items.reduce(
      (sum, item) => sum + (item.amount ?? 0),
      0,
    );

    if (itemTotal !== draft.totalAmount) {
      issues.push({
        code: 'total_amount_mismatch',
        message: '예산 항목 합계와 총 계획 예산이 일치하지 않습니다.',
        path: 'totalAmount',
      });
    }
  }

  return issues;
}
