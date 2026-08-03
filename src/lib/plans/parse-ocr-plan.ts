import { validatePlanDraft } from '@/lib/plans/plan-schema';
import type {
  OcrPageText,
  ParsedPlan,
  PlanDraft,
  PlanItemDraft,
} from '@/lib/plans/types';
import type { DocumentOcrResult } from '@/lib/upstage/document-ocr';

const TITLE_LABEL = /^(?:집행\s*)?(?:계획명|사업명|프로그램명)\s*[:：]\s*(.+)$/;
const PERIOD_LABEL = /^(?:집행\s*)?기간\s*[:：]?\s*(.+)$/;
const TOTAL_LABEL = /(?:총\s*(?:계획\s*)?(?:예산|금액)|합계)/;
const FULL_DATE =
  /(\d{4})\s*(?:[./-]|년)\s*(\d{1,2})\s*(?:[./-]|월)\s*(\d{1,2})\s*(?:일)?/g;
const AMOUNT_AT_END = /([+-]?\s*[\dOoIl,\s]+)\s*(?:원|₩)\s*$/;
const STRUCTURAL_LABEL =
  /[ \t]+(?=(?:집행\s*)?(?:계획명|사업명|프로그램명|기간)\s*[:：]|(?:항목명|계획\s*항목)\s*[:：]|(?:총\s*(?:계획\s*)?(?:예산|금액)|합계)\s*[:：]?)/g;

function normalizeText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeDate(match: RegExpMatchArray) {
  const [, year, month, day] = match;
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().startsWith(date)
    ? date
    : '';
}

function extractDates(value: string) {
  return Array.from(value.matchAll(FULL_DATE), normalizeDate).filter(Boolean);
}

function splitJoinedPeriodLine(line: string) {
  if (!PERIOD_LABEL.test(line)) {
    return [line];
  }

  const dates = Array.from(line.matchAll(FULL_DATE));
  const secondDate = dates[1];
  if (!secondDate || secondDate.index === undefined) {
    return [line];
  }

  const periodEnd = secondDate.index + secondDate[0].length;
  const period = line.slice(0, periodEnd).trim();
  const remainder = line
    .slice(periodEnd)
    .replace(/^[\s.~～\-–—]+/, '')
    .trim();
  return remainder ? [period, remainder] : [period];
}

function splitJoinedItemLines(line: string) {
  return line
    .replace(
      /(\d\s*원)\s+(?=(?:[-•·]\s*|\d+[.)]\s*)?[^|｜\n]{1,120}\s*[|｜])/g,
      '$1\n',
    )
    .split('\n')
    .map(normalizeText)
    .filter(Boolean);
}

function logicalLines(value: string) {
  const separated = value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(STRUCTURAL_LABEL, '\n');

  return separated
    .split(/\r?\n/)
    .map(normalizeText)
    .filter(Boolean)
    .flatMap(splitJoinedPeriodLine)
    .flatMap(splitJoinedItemLines);
}

function parseAmount(value: string) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/[Oo]/g, '0')
    .replace(/[Il]/g, '1')
    .replace(/,/g, '');

  if (!/^\+?\d+$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? amount : null;
}

function parseItemLine(
  line: string,
  index: number,
  pages: OcrPageText[],
): PlanItemDraft | null {
  if (TOTAL_LABEL.test(line) || PERIOD_LABEL.test(line)) {
    return null;
  }

  const labeledMatch = line.match(
    /^(?:항목명|계획\s*항목)\s*[:：]\s*(.+?)\s+(?:사용\s*목적|설명|내용)\s*[:：]\s*(.+?)\s+(?:계획\s*금액|금액)\s*[:：]\s*([+-]?\s*[\dOoIl,\s]+)\s*(?:원|₩)\s*$/,
  );
  if (labeledMatch) {
    const name = labeledMatch[1].trim();
    const description = labeledMatch[2].trim();
    const amount = parseAmount(labeledMatch[3]);
    if (!name || !description || amount === null) return null;
    const sourcePage = pages.find((page) => page.text.includes(line));
    return {
      id: `ocr-item-${index + 1}`,
      name,
      description,
      amount,
      confidence: sourcePage?.confidence ?? null,
      sourceText: line,
      sourceName: name,
      sourceAmount: amount,
    };
  }

  const amountMatch = line.match(AMOUNT_AT_END);
  if (!amountMatch || amountMatch.index === undefined) {
    return null;
  }

  const amount = parseAmount(amountMatch[1]);
  const rawLabel = line.slice(0, amountMatch.index).trim();
  const segments = rawLabel
    .split(/\s*[|｜]\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const name = (segments[0] ?? '')
    .replace(/^(?:[-•·]\s*|\d+[.)]\s*)/, '')
    .trim();

  if (!name || /^\d+$/.test(name)) {
    return null;
  }

  const sourcePage = pages.find((page) => page.text.includes(line));

  return {
    id: `ocr-item-${index + 1}`,
    name,
    description: segments.slice(1).join(' · '),
    amount,
    confidence: sourcePage?.confidence ?? null,
    sourceText: line,
    sourceName: name,
    sourceAmount: amount,
  };
}

function findTitle(lines: string[]) {
  for (const line of lines) {
    const match = line.match(TITLE_LABEL);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return '';
}

function findPeriod(lines: string[]) {
  for (const line of lines) {
    const match = line.match(PERIOD_LABEL);
    if (!match?.[1]) {
      continue;
    }

    const dates = extractDates(match[1]);
    if (dates.length >= 2) {
      return [dates[0], dates[1]] as const;
    }
  }

  return ['', ''] as const;
}

function findTotal(lines: string[]) {
  for (const line of lines) {
    if (!TOTAL_LABEL.test(line)) {
      continue;
    }

    const match = line.match(AMOUNT_AT_END);
    if (match) {
      return parseAmount(match[1]);
    }
  }

  return null;
}

export function parseOcrPlan(
  ocr: DocumentOcrResult,
  processedAt = new Date().toISOString(),
): ParsedPlan {
  const lines = ocr.pages.flatMap((page) => logicalLines(page.text));
  const [periodStart, periodEnd] = findPeriod(lines);
  const items = lines
    .map((line, index) => parseItemLine(line, index, ocr.pages))
    .filter((item): item is PlanItemDraft => item !== null);
  const draft: PlanDraft = {
    title: findTitle(lines),
    periodStart,
    periodEnd,
    totalAmount: findTotal(lines),
    items,
  };

  return {
    draft,
    issues: validatePlanDraft(draft),
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
