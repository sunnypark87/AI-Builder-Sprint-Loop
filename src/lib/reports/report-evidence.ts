import type {
  ReportEvidence,
  ReportEvidenceExecution,
  ReportEvidenceItem,
} from './types';

export type RawReportEvidence = {
  organizationId: string;
  donationId: string;
  pledgeId: string;
  purpose: string;
  donationCondition: string;
  plan: {
    id: string;
    title: string;
    periodStart: string;
    periodEnd: string;
    totalAmount: number;
    items: { id: string; name: string; description: string; amount: number }[];
  };
  executions: ReportEvidenceExecution[];
};

export class ReportEvidenceError extends Error {
  constructor(
    public readonly code:
      | 'missing_execution'
      | 'invalid_amount'
      | 'plan_total_mismatch'
      | 'invalid_execution_reference'
      | 'execution_outside_period'
      | 'budget_exceeded',
    message: string,
  ) {
    super(message);
    this.name = 'ReportEvidenceError';
  }
}

function assertAmount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ReportEvidenceError(
      'invalid_amount',
      '보고 근거의 금액을 확인할 수 없습니다.',
    );
  }
}

export function buildReportEvidence(source: RawReportEvidence): ReportEvidence {
  assertAmount(source.plan.totalAmount);
  if (source.executions.length === 0) {
    throw new ReportEvidenceError(
      'missing_execution',
      '등록된 집행 내역이 한 건 이상 필요합니다.',
    );
  }

  const itemIds = new Set(source.plan.items.map((item) => item.id));
  const plannedTotal = source.plan.items.reduce((sum, item) => {
    assertAmount(item.amount);
    return sum + item.amount;
  }, 0);
  if (plannedTotal !== source.plan.totalAmount) {
    throw new ReportEvidenceError(
      'plan_total_mismatch',
      '계획 항목 합계와 계획 총액이 일치하지 않습니다.',
    );
  }

  for (const execution of source.executions) {
    assertAmount(execution.totalAmount);
    if (!itemIds.has(execution.planItemId)) {
      throw new ReportEvidenceError(
        'invalid_execution_reference',
        '집행 내역이 보고 대상 계획 항목과 일치하지 않습니다.',
      );
    }
    if (
      execution.transactionDate < source.plan.periodStart ||
      execution.transactionDate > source.plan.periodEnd
    ) {
      throw new ReportEvidenceError(
        'execution_outside_period',
        '계획 기간 밖의 집행 내역이 포함되어 있습니다.',
      );
    }
  }

  const items: ReportEvidenceItem[] = source.plan.items.map((item) => {
    const executions = source.executions.filter(
      (execution) => execution.planItemId === item.id,
    );
    const spentAmount = executions.reduce(
      (sum, execution) => sum + execution.totalAmount,
      0,
    );
    if (spentAmount > item.amount) {
      throw new ReportEvidenceError(
        'budget_exceeded',
        '집행 금액이 계획 항목의 예산을 초과했습니다.',
      );
    }
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      plannedAmount: item.amount,
      spentAmount,
      remainingAmount: item.amount - spentAmount,
      executionIds: executions.map((execution) => execution.id),
    };
  });
  const spentAmount = items.reduce((sum, item) => sum + item.spentAmount, 0);
  if (spentAmount > source.plan.totalAmount) {
    throw new ReportEvidenceError(
      'budget_exceeded',
      '총 집행 금액이 계획 예산을 초과했습니다.',
    );
  }

  return {
    version: 1,
    organizationId: source.organizationId,
    donationId: source.donationId,
    pledgeId: source.pledgeId,
    purpose: source.purpose.trim(),
    donationCondition: source.donationCondition.trim(),
    plan: {
      id: source.plan.id,
      title: source.plan.title.trim(),
      periodStart: source.plan.periodStart,
      periodEnd: source.plan.periodEnd,
      totalAmount: source.plan.totalAmount,
      spentAmount,
      remainingAmount: source.plan.totalAmount - spentAmount,
      executionCount: source.executions.length,
      items,
    },
    executions: source.executions.map((execution) => ({
      id: execution.id,
      planItemId: execution.planItemId,
      merchantName: execution.merchantName.trim(),
      transactionDate: execution.transactionDate,
      totalAmount: execution.totalAmount,
    })),
  };
}

export function reportEvidenceIds(evidence: ReportEvidence) {
  return new Set([
    `pledge:${evidence.pledgeId}`,
    `plan:${evidence.plan.id}`,
    ...evidence.plan.items.map((item) => `plan-item:${item.id}`),
    ...evidence.executions.map((execution) => `execution:${execution.id}`),
  ]);
}

export function parseReportEvidence(value: unknown): ReportEvidence | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const plan = candidate.plan;
  if (
    candidate.version !== 1 ||
    typeof candidate.organizationId !== 'string' ||
    typeof candidate.donationId !== 'string' ||
    typeof candidate.pledgeId !== 'string' ||
    typeof candidate.purpose !== 'string' ||
    typeof candidate.donationCondition !== 'string' ||
    typeof plan !== 'object' ||
    plan === null ||
    Array.isArray(plan) ||
    !Array.isArray(candidate.executions)
  ) {
    return null;
  }
  const parsedPlan = plan as Record<string, unknown>;
  if (
    typeof parsedPlan.id !== 'string' ||
    typeof parsedPlan.title !== 'string' ||
    typeof parsedPlan.periodStart !== 'string' ||
    typeof parsedPlan.periodEnd !== 'string' ||
    typeof parsedPlan.totalAmount !== 'number' ||
    typeof parsedPlan.spentAmount !== 'number' ||
    typeof parsedPlan.remainingAmount !== 'number' ||
    typeof parsedPlan.executionCount !== 'number' ||
    !Array.isArray(parsedPlan.items)
  ) {
    return null;
  }
  const items = parsedPlan.items;
  const executions = candidate.executions;
  if (
    !items.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item) &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        typeof (item as Record<string, unknown>).description === 'string' &&
        typeof (item as Record<string, unknown>).plannedAmount === 'number' &&
        typeof (item as Record<string, unknown>).spentAmount === 'number' &&
        typeof (item as Record<string, unknown>).remainingAmount === 'number' &&
        Array.isArray((item as Record<string, unknown>).executionIds),
    ) ||
    !executions.every(
      (execution) =>
        typeof execution === 'object' &&
        execution !== null &&
        !Array.isArray(execution) &&
        typeof (execution as Record<string, unknown>).id === 'string' &&
        typeof (execution as Record<string, unknown>).planItemId === 'string' &&
        typeof (execution as Record<string, unknown>).merchantName ===
          'string' &&
        typeof (execution as Record<string, unknown>).transactionDate ===
          'string' &&
        typeof (execution as Record<string, unknown>).totalAmount === 'number',
    )
  ) {
    return null;
  }
  return value as ReportEvidence;
}
