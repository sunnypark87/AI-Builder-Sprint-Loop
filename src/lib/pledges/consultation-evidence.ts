import type { AiPledgePatch, PledgeField } from './ai-schema';

const AMOUNT_UNITS: Record<string, number> = {
  '': 1,
  원: 1,
  만: 10_000,
  만원: 10_000,
  십만: 100_000,
  십만원: 100_000,
  백만: 1_000_000,
  백만원: 1_000_000,
  천만: 10_000_000,
  천만원: 10_000_000,
  억: 100_000_000,
  억원: 100_000_000,
};

/**
 * Limits a model proposal to values supported by the latest donor utterance.
 * Organization data, stored pledge values, and assistant messages are context,
 * never evidence for a new patch.
 */
export function groundPatchInLatestUserMessage(input: {
  message: string;
  modelPatch: AiPledgePatch;
}): AiPledgePatch {
  const message = normalize(input.message);
  const patch: AiPledgePatch = {};
  const amount = parseKoreanWon(input.message);

  if (amount !== null) patch.amount = amount;

  const designation = explicitDesignation(message);
  if (designation) patch.donationDesignation = designation;

  if (
    input.modelPatch.donationCondition !== undefined &&
    conditionIsExplicit(message, input.modelPatch.donationCondition)
  ) {
    patch.donationCondition = input.modelPatch.donationCondition;
  }

  const schedule = explicitSchedule(message);
  if (schedule) patch.paymentSchedule = schedule;
  if (
    schedule === 'other' &&
    input.modelPatch.paymentScheduleOther !== undefined
  )
    patch.paymentScheduleOther = input.modelPatch.paymentScheduleOther;

  const method = explicitPaymentMethod(message);
  if (method) patch.paymentMethod = method;
  if (method === 'other' && input.modelPatch.paymentMethodOther !== undefined)
    patch.paymentMethodOther = input.modelPatch.paymentMethodOther;

  return patch;
}

export function parseKoreanWon(value: string): number | null {
  const compact = value.replaceAll(',', '').replace(/\s+/g, '');
  const match = compact.match(
    /(?:^|[^0-9])([0-9]+(?:\.[0-9]+)?)(억원|억|천만원|천만|백만원|백만|십만원|십만|만원|만|원)(?:[^0-9]|$)/,
  );
  if (match) {
    const amount = Number(match[1]) * AMOUNT_UNITS[match[2]];
    return validAmount(amount) ? amount : null;
  }
  if (/^[0-9]+$/.test(compact)) {
    const amount = Number(compact);
    return validAmount(amount) ? amount : null;
  }
  return null;
}

/** Returns the field a donor chose to discuss before providing its value. */
export function getRequestedQuestionField(value: string): PledgeField | null {
  const message = normalize(value);
  if (/(기부유형|기부방식|지정여부).*(부터|먼저|정할|알려)/.test(message))
    return 'donationDesignation';
  if (/(기부금액|금액).*(부터|먼저|정할|알려)/.test(message)) return 'amount';
  if (/(납부시점|납부주기|납부일정).*(부터|먼저|정할|알려)/.test(message))
    return 'paymentSchedule';
  if (/(납부수단|납부방법|결제수단).*(부터|먼저|정할|알려)/.test(message))
    return 'paymentMethod';
  return null;
}

function explicitDesignation(message: string) {
  if (message.includes('비지정')) return 'undesignated' as const;
  if (message.includes('지정기부') || message.includes('지정후원'))
    return 'designated' as const;
  return null;
}

function explicitSchedule(message: string) {
  if (/(일시납부|일시불|한번에|한차례)/.test(message))
    return 'lump_sum' as const;
  if (/(분할|매월|월마다|매달|분기|격월|나누어|나눠서)/.test(message))
    return 'other' as const;
  return null;
}

function explicitPaymentMethod(message: string) {
  if (message.includes('온라인')) return 'online' as const;
  if (/(직접전달|직접납부|현장전달)/.test(message)) return 'direct' as const;
  if (/(계좌이체|자동이체|무통장|카드|현금|기타수단)/.test(message))
    return 'other' as const;
  return null;
}

function conditionIsExplicit(message: string, condition: string | null) {
  if (!condition) return false;
  const conditionText = normalize(condition);
  return conditionText.length > 1 && message.includes(conditionText);
}

function validAmount(value: number) {
  return Number.isSafeInteger(value) && value > 0 && value <= 10_000_000_000;
}

function normalize(value: string) {
  return value.replace(/[^\p{L}\p{N}]+/gu, '').toLocaleLowerCase('ko-KR');
}
