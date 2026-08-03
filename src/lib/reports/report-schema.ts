import { reportEvidenceIds } from './report-evidence';
import type {
  ReportContent,
  ReportEvidence,
  ReportItemNarrative,
  ReportNarrative,
  ReportValidationIssue,
} from './types';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null;
}

function narrative(value: unknown): ReportNarrative | null {
  const candidate = record(value);
  const evidenceIds = strings(candidate?.evidenceIds);
  if (!candidate || typeof candidate.text !== 'string' || !evidenceIds) {
    return null;
  }
  return { text: candidate.text, evidenceIds };
}

export function parseReportContent(value: unknown): ReportContent | null {
  const candidate = record(value);
  if (
    !candidate ||
    candidate.version !== 1 ||
    typeof candidate.title !== 'string'
  ) {
    return null;
  }
  const summary = narrative(candidate.summary);
  const planComparison = narrative(candidate.planComparison);
  const outcomes = narrative(candidate.outcomes);
  const nextSteps = narrative(candidate.nextSteps);
  if (
    !summary ||
    !planComparison ||
    !outcomes ||
    !nextSteps ||
    !Array.isArray(candidate.items)
  ) {
    return null;
  }
  const items: ReportItemNarrative[] = [];
  for (const value of candidate.items) {
    const item = record(value);
    const parsed = narrative(value);
    if (
      !item ||
      !parsed ||
      typeof item.planItemId !== 'string' ||
      typeof item.title !== 'string'
    ) {
      return null;
    }
    items.push({ planItemId: item.planItemId, title: item.title, ...parsed });
  }
  return {
    version: 1,
    title: candidate.title,
    summary,
    planComparison,
    items,
    outcomes,
    nextSteps,
  };
}

const HTML = /<\/?[a-z][^>]*>/i;
const NUMERIC_CLAIM = /(?:[+-]\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|원|건|회|명)?/g;
const DATE_CLAIMS = [
  /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
  /\b(\d{4})\.(\d{1,2})\.(\d{1,2})\.?/g,
  /\b(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
];

type NumericClaimKind = 'money' | 'count' | 'percent';

function normalizedNumericClaim(value: string) {
  const match = value
    .trim()
    .match(/^([+-]?)\s*(\d[\d,]*(?:\.\d+)?)\s*(%|원|건|회|명)?$/);
  if (!match) return null;
  const parsed = Number(`${match[1]}${match[2].replaceAll(',', '')}`);
  if (!Number.isFinite(parsed)) return null;
  const kind: NumericClaimKind | null =
    match[3] === '원'
      ? 'money'
      : match[3] === '건' || match[3] === '회'
        ? 'count'
        : match[3] === '%'
          ? 'percent'
          : null;
  return kind ? `${parsed}:${kind}` : null;
}

function allowedNumericClaimsByEvidence(evidence: ReportEvidence) {
  const claims = new Map<string, Set<string>>();
  const add = (evidenceId: string, value: number, kind: NumericClaimKind) => {
    const values = claims.get(evidenceId) ?? new Set<string>();
    values.add(`${value}:${kind}`);
    claims.set(evidenceId, values);
  };
  const planId = `plan:${evidence.plan.id}`;
  add(planId, evidence.plan.totalAmount, 'money');
  add(planId, evidence.plan.spentAmount, 'money');
  add(planId, evidence.plan.remainingAmount, 'money');
  add(planId, evidence.plan.executionCount, 'count');
  if (evidence.plan.totalAmount > 0) {
    add(
      planId,
      Math.round((evidence.plan.spentAmount / evidence.plan.totalAmount) * 100),
      'percent',
    );
  }
  for (const item of evidence.plan.items) {
    const itemId = `plan-item:${item.id}`;
    add(itemId, item.plannedAmount, 'money');
    add(itemId, item.spentAmount, 'money');
    add(itemId, item.remainingAmount, 'money');
    add(itemId, item.executionIds.length, 'count');
    if (item.plannedAmount > 0) {
      add(
        itemId,
        Math.round((item.spentAmount / item.plannedAmount) * 100),
        'percent',
      );
    }
  }
  for (const execution of evidence.executions) {
    add(`execution:${execution.id}`, execution.totalAmount, 'money');
  }
  return claims;
}

function allowedDateClaimsByEvidence(evidence: ReportEvidence) {
  return new Map<string, Set<string>>([
    [
      `plan:${evidence.plan.id}`,
      new Set([evidence.plan.periodStart, evidence.plan.periodEnd]),
    ],
    ...evidence.executions.map(
      (execution) =>
        [
          `execution:${execution.id}`,
          new Set([execution.transactionDate]),
        ] as const,
    ),
  ]);
}

function groundedLabelsByEvidence(evidence: ReportEvidence) {
  const labels = new Map<string, string[]>();
  labels.set(`pledge:${evidence.pledgeId}`, [
    evidence.purpose,
    evidence.donationCondition,
  ]);
  labels.set(`plan:${evidence.plan.id}`, [evidence.plan.title]);
  for (const item of evidence.plan.items) {
    labels.set(`plan-item:${item.id}`, [item.name]);
  }
  for (const execution of evidence.executions) {
    labels.set(`execution:${execution.id}`, [execution.merchantName]);
  }
  return labels;
}

function removeGroundedLabels(value: string, labels: string[]) {
  return labels
    .filter(
      (label) =>
        label.length > 0 && /\d/.test(label) && /[A-Za-z가-힣]/.test(label),
    )
    .sort((left, right) => right.length - left.length)
    .reduce((remaining, label) => remaining.replaceAll(label, ''), value);
}

function normalizeDateClaim(year: string, month: string, day: string) {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function removeDateClaims(
  value: string,
  allowedDates: Set<string>,
  onUnsupported: (claim: string) => void,
) {
  let remaining = value;
  for (const pattern of DATE_CLAIMS) {
    remaining = remaining.replace(
      pattern,
      (claim, year: string, month: string, day: string) => {
        if (!allowedDates.has(normalizeDateClaim(year, month, day))) {
          onUnsupported(claim);
        }
        return '';
      },
    );
  }
  return remaining;
}

export function validateReportContent(
  content: ReportContent,
  evidence: ReportEvidence,
): ReportValidationIssue[] {
  const issues: ReportValidationIssue[] = [];
  const knownEvidence = reportEvidenceIds(evidence);
  const allowedNumbersByEvidence = allowedNumericClaimsByEvidence(evidence);
  const allowedDatesByEvidence = allowedDateClaimsByEvidence(evidence);
  const labelsByEvidence = groundedLabelsByEvidence(evidence);
  const validateText = (
    value: string,
    path: string,
    max: number,
    evidenceIds: string[] = [],
    sourceLabels: string[] = [],
  ) => {
    if (!value.trim()) {
      issues.push({ code: 'required', path, message: '내용을 입력해 주세요.' });
    } else if (value.length > max) {
      issues.push({
        code: 'too_long',
        path,
        message: `${max}자 이하로 입력해 주세요.`,
      });
    }
    if (HTML.test(value)) {
      issues.push({
        code: 'html_not_allowed',
        path,
        message: 'HTML은 보고서에 사용할 수 없습니다.',
      });
    }
    let unsupportedDate = '';
    const groundedLabels = [
      ...sourceLabels,
      ...evidenceIds.flatMap(
        (evidenceId) => labelsByEvidence.get(evidenceId) ?? [],
      ),
    ];
    const withoutLabels = removeGroundedLabels(value, groundedLabels);
    const allowedDates = new Set(
      evidenceIds.flatMap((evidenceId) => [
        ...(allowedDatesByEvidence.get(evidenceId) ?? []),
      ]),
    );
    const withoutDates = removeDateClaims(
      withoutLabels,
      allowedDates,
      (claim) => {
        unsupportedDate ||= claim;
      },
    );
    const allowedNumbers = new Set(
      evidenceIds.flatMap((evidenceId) => [
        ...(allowedNumbersByEvidence.get(evidenceId) ?? []),
      ]),
    );
    const unsupportedNumber = (withoutDates.match(NUMERIC_CLAIM) ?? []).find(
      (claim) => {
        const normalized = normalizedNumericClaim(claim);
        return !normalized || !allowedNumbers.has(normalized);
      },
    );
    const unsupportedClaim = unsupportedDate || unsupportedNumber;
    if (unsupportedClaim) {
      issues.push({
        code: 'numeric_claim_not_allowed',
        path,
        message: `근거에서 확인할 수 없는 수치(${unsupportedClaim})가 포함되어 있습니다.`,
      });
    }
  };
  const validateNarrative = (value: ReportNarrative, path: string) => {
    validateText(value.text, `${path}.text`, 1200, value.evidenceIds);
    if (value.evidenceIds.length === 0) {
      issues.push({
        code: 'missing_evidence',
        path: `${path}.evidenceIds`,
        message: '문장의 근거를 한 개 이상 선택해 주세요.',
      });
    }
    for (const evidenceId of value.evidenceIds) {
      if (!knownEvidence.has(evidenceId)) {
        issues.push({
          code: 'unknown_evidence',
          path: `${path}.evidenceIds`,
          message: '보고 대상에 없는 근거가 포함되어 있습니다.',
        });
      }
    }
  };

  validateText(
    content.title,
    'title',
    200,
    [],
    [evidence.purpose, evidence.plan.title],
  );
  validateNarrative(content.summary, 'summary');
  validateNarrative(content.planComparison, 'planComparison');
  validateNarrative(content.outcomes, 'outcomes');
  validateNarrative(content.nextSteps, 'nextSteps');

  const expectedItemIds = new Set(evidence.plan.items.map((item) => item.id));
  const actualItemIds = new Set(content.items.map((item) => item.planItemId));
  if (
    actualItemIds.size !== content.items.length ||
    actualItemIds.size !== expectedItemIds.size ||
    [...expectedItemIds].some((id) => !actualItemIds.has(id))
  ) {
    issues.push({
      code: 'item_mismatch',
      path: 'items',
      message: '계획 항목별 설명 구성이 보고 근거와 일치하지 않습니다.',
    });
  }
  content.items.forEach((item, index) => {
    validateText(item.title, `items.${index}.title`, 200, item.evidenceIds);
    validateNarrative(item, `items.${index}`);
    if (!item.evidenceIds.includes(`plan-item:${item.planItemId}`)) {
      issues.push({
        code: 'missing_evidence',
        path: `items.${index}.evidenceIds`,
        message: '계획 항목 근거가 필요합니다.',
      });
    }
  });
  return issues;
}

export function parseAndValidateReportContent(
  value: unknown,
  evidence: ReportEvidence,
) {
  const content = parseReportContent(value);
  if (!content) {
    return {
      content: null,
      issues: [
        {
          code: 'invalid_shape' as const,
          path: '',
          message: '보고서 구조를 확인할 수 없습니다.',
        },
      ],
    };
  }
  return { content, issues: validateReportContent(content, evidence) };
}
