import {
  RECEIPT_OCR_CONFIDENCE_THRESHOLD,
  type ReceiptDraft,
  type ReceiptValidationIssue,
  type ReceiptVerificationContext,
  type ReceiptVerificationResult,
} from '@/lib/executions/types';

function result(
  code: ReceiptVerificationResult['code'],
  outcome: ReceiptVerificationResult['outcome'],
  message: string,
  evidence: string,
): ReceiptVerificationResult {
  return { code, version: 1, outcome, message, evidence };
}

export function isValidBusinessNumber(value: string) {
  if (!/^\d{10}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const sum = weights.reduce(
    (total, weight, index) => total + weight * digits[index],
    0,
  );
  const check = (10 - ((sum + Math.floor((digits[8] * 5) / 10)) % 10)) % 10;
  return check === digits[9];
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

export function verifyReceipt(
  draft: ReceiptDraft,
  issues: ReceiptValidationIssue[],
  context: ReceiptVerificationContext,
) {
  const results: ReceiptVerificationResult[] = [];
  const itemAmounts = draft.items.map((item) => item.amount);
  const lowConfidenceItems = draft.items.filter(
    (item) =>
      item.confidence !== null &&
      item.confidence < RECEIPT_OCR_CONFIDENCE_THRESHOLD,
  );
  const itemTotal = itemAmounts.every((amount) => amount !== null)
    ? (itemAmounts as number[]).reduce((sum, amount) => sum + amount, 0)
    : null;

  if (
    draft.supplyAmount !== null &&
    draft.taxAmount !== null &&
    draft.totalAmount !== null
  ) {
    const calculated = draft.supplyAmount + draft.taxAmount;
    results.push(
      result(
        'receipt_arithmetic',
        calculated === draft.totalAmount ? 'passed' : 'blocked',
        calculated === draft.totalAmount
          ? '공급가액과 부가세 합계가 영수증 합계와 일치합니다.'
          : '공급가액과 부가세 합계가 영수증 합계와 다릅니다.',
        `${calculated} / ${draft.totalAmount}`,
      ),
    );
  } else {
    results.push(
      result(
        'receipt_arithmetic',
        'warning',
        '공급가액 또는 부가세가 없어 영수증 산술 합계를 확인할 수 없습니다.',
        '필드 누락',
      ),
    );
  }

  results.push(
    result(
      'item_total',
      itemTotal === null || draft.items.length === 0
        ? 'warning'
        : itemTotal === draft.totalAmount
          ? 'passed'
          : 'blocked',
      itemTotal === null || draft.items.length === 0
        ? '품목 합계를 확인할 수 없어 담당자 검토가 필요합니다.'
        : itemTotal === draft.totalAmount
          ? '품목 합계가 영수증 합계와 일치합니다.'
          : '품목 합계가 영수증 합계와 다릅니다.',
      itemTotal === null
        ? '계산 불가'
        : `${itemTotal} / ${draft.totalAmount ?? '없음'}`,
    ),
  );

  results.push(
    result(
      'business_number_checksum',
      !draft.businessNumber
        ? 'warning'
        : isValidBusinessNumber(draft.businessNumber)
          ? 'passed'
          : 'blocked',
      !draft.businessNumber
        ? '사업자등록번호가 없어 형식 검증을 수행하지 못했습니다.'
        : isValidBusinessNumber(draft.businessNumber)
          ? '사업자등록번호 체크섬이 유효합니다. 실제 사업자 상태를 뜻하지는 않습니다.'
          : '사업자등록번호 체크섬이 올바르지 않습니다.',
      draft.businessNumber
        ? `끝 4자리 ${draft.businessNumber.slice(-4)}`
        : '필드 누락',
    ),
  );

  const transactionDate = draft.transactionAt
    ? dateOnly(draft.transactionAt)
    : '';
  const inPeriod =
    transactionDate >= context.planPeriodStart &&
    transactionDate <= context.planPeriodEnd;
  results.push(
    result(
      'plan_period',
      !transactionDate ? 'blocked' : inPeriod ? 'passed' : 'blocked',
      !transactionDate
        ? '거래일을 확인할 수 없습니다.'
        : inPeriod
          ? '거래일이 집행 계획 기간 안에 있습니다.'
          : '거래일이 집행 계획 기간을 벗어납니다.',
      `${transactionDate || '없음'} / ${context.planPeriodStart}~${context.planPeriodEnd}`,
    ),
  );

  const paidDate = context.donationPaidAt
    ? dateOnly(context.donationPaidAt)
    : null;
  results.push(
    result(
      'donation_paid_at',
      !paidDate
        ? 'warning'
        : transactionDate && transactionDate >= paidDate
          ? 'passed'
          : 'blocked',
      !paidDate
        ? '권위 있는 결제 확정 시각이 없어 담당자 확인이 필요합니다.'
        : transactionDate >= paidDate
          ? '거래일이 기부 결제 확정일 이후입니다.'
          : '거래일이 기부 결제 확정일보다 빠릅니다.',
      paidDate ?? '결제 확정 시각 없음',
    ),
  );

  const amount = draft.totalAmount ?? 0;
  results.push(
    result(
      'remaining_budget',
      amount > 0 && amount <= context.remainingBudget ? 'passed' : 'blocked',
      amount > 0 && amount <= context.remainingBudget
        ? '집행 금액이 현재 예산 잔액 이내입니다.'
        : '집행 금액이 예산 잔액을 초과하거나 올바르지 않습니다.',
      `${amount} / ${context.remainingBudget}`,
    ),
  );

  results.push(
    result(
      'duplicate_source',
      context.duplicateSource ? 'blocked' : 'passed',
      context.duplicateSource
        ? '동일한 원본 파일이 이미 등록됐습니다.'
        : '동일한 원본 파일이 없습니다.',
      context.sourceFingerprint.slice(0, 12),
    ),
  );
  results.push(
    result(
      'duplicate_transaction',
      context.duplicateTransaction ? 'blocked' : 'passed',
      context.duplicateTransaction
        ? '핵심 거래 정보가 같은 영수증이 이미 등록됐습니다.'
        : '핵심 거래 정보가 같은 등록 내역이 없습니다.',
      context.duplicateTransaction ? '중복 후보 있음' : '중복 후보 없음',
    ),
  );
  results.push(
    result(
      'ocr_review',
      issues.length > 0 || lowConfidenceItems.length > 0 ? 'warning' : 'passed',
      issues.length > 0 || lowConfidenceItems.length > 0
        ? 'OCR 추출값에 수정이 필요하거나 신뢰도가 낮은 항목이 있습니다.'
        : '필수 OCR 추출값의 형식 검사를 통과했습니다.',
      `검증 이슈 ${issues.length}개 / 신뢰도 ${RECEIPT_OCR_CONFIDENCE_THRESHOLD} 미만 품목 ${lowConfidenceItems.length}개`,
    ),
  );
  return results;
}

export function hasBlockedVerification(results: ReceiptVerificationResult[]) {
  return results.some((item) => item.outcome === 'blocked');
}

export function hasVerificationWarning(results: ReceiptVerificationResult[]) {
  return results.some((item) => item.outcome === 'warning');
}
