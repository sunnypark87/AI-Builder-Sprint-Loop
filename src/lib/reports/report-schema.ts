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
const NUMERIC_CLAIM = /\d[\d,]*(?:\.\d+)?%?/g;

function normalizedNumber(value: string) {
  const percent = value.endsWith('%');
  const parsed = Number(value.replaceAll(',', '').replace('%', ''));
  return Number.isFinite(parsed) ? `${parsed}${percent ? '%' : ''}` : value;
}

function allowedNumericClaims(evidence: ReportEvidence) {
  const values = new Set<string>();
  const add = (value: number) => values.add(String(value));
  add(evidence.plan.totalAmount);
  add(evidence.plan.spentAmount);
  add(evidence.plan.remainingAmount);
  add(evidence.plan.executionCount);
  if (evidence.plan.totalAmount > 0) {
    values.add(
      `${Math.round((evidence.plan.spentAmount / evidence.plan.totalAmount) * 100)}%`,
    );
  }
  for (const item of evidence.plan.items) {
    add(item.plannedAmount);
    add(item.spentAmount);
    add(item.remainingAmount);
  }
  for (const execution of evidence.executions) add(execution.totalAmount);
  for (const date of [
    evidence.plan.periodStart,
    evidence.plan.periodEnd,
    ...evidence.executions.map((execution) => execution.transactionDate),
  ]) {
    date.split('-').forEach((part) => add(Number(part)));
  }
  return values;
}

export function validateReportContent(
  content: ReportContent,
  evidence: ReportEvidence,
): ReportValidationIssue[] {
  const issues: ReportValidationIssue[] = [];
  const knownEvidence = reportEvidenceIds(evidence);
  const allowedNumbers = allowedNumericClaims(evidence);
  const validateText = (value: string, path: string, max: number) => {
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
    const unsupportedNumber = (value.match(NUMERIC_CLAIM) ?? []).find(
      (claim) => !allowedNumbers.has(normalizedNumber(claim)),
    );
    if (unsupportedNumber) {
      issues.push({
        code: 'numeric_claim_not_allowed',
        path,
        message: `근거에서 확인할 수 없는 수치(${unsupportedNumber})가 포함되어 있습니다.`,
      });
    }
  };
  const validateNarrative = (value: ReportNarrative, path: string) => {
    validateText(value.text, `${path}.text`, 1200);
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

  validateText(content.title, 'title', 200);
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
    validateText(item.title, `items.${index}.title`, 200);
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
