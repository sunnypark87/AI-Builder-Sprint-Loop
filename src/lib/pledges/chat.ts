export type PledgeChatRole = 'user' | 'assistant';

export type PledgeChatPatch = Partial<{
  amount: number;
  donationDesignation: 'designated' | 'undesignated';
  donationCondition: string;
  paymentSchedule: 'lump_sum' | 'other';
  paymentScheduleOther: string;
  paymentMethod: 'online' | 'direct' | 'other';
  paymentMethodOther: string;
}>;

export type PledgeChatMessage = {
  id?: string;
  missingFields?: string[];
  nextQuestionField?: string | null;
  role: PledgeChatRole;
  content: string;
  proposedPatch?: PledgeChatPatch;
  createdAt?: string;
  suggestedReplies?: Array<{
    id: string;
    label: string;
    message: string;
  }>;
};

export function createMockAssistantReply(message: string) {
  const normalized = message.replace(/\s/g, '');
  const amount = message.match(/(?:월|매달|매월)?\s*([0-9,]+)\s*만원/);
  const amountWon = amount
    ? Number(amount[1].replaceAll(',', '')) * 10_000
    : null;

  if (amountWon) {
    return {
      content: `기부 금액을 월 ${amountWon.toLocaleString('ko-KR')}원으로 약정서에 작성했어요. 다음 검토 화면에서 수정할 수 있어요.`,
      proposedPatch: { amount: amountWon },
    } satisfies Omit<PledgeChatMessage, 'role'>;
  }

  if (normalized.includes('비지정') || normalized.includes('필요한곳')) {
    return {
      content: '비지정 기부로 정리했어요. 기부 조건은 작성하지 않습니다.',
      proposedPatch: { donationDesignation: 'undesignated' },
    } satisfies Omit<PledgeChatMessage, 'role'>;
  }

  if (normalized.includes('교육') || normalized.includes('조건')) {
    return {
      content:
        '지정 기부 조건으로 약정서에 작성했어요. 다음 검토 화면에서 수정할 수 있어요.',
      proposedPatch: { donationCondition: message.trim() },
    } satisfies Omit<PledgeChatMessage, 'role'>;
  }

  if (normalized.includes('지정')) {
    return {
      content: '지정 기부로 정리했어요. 기부금을 사용할 활동을 알려주세요.',
      proposedPatch: { donationDesignation: 'designated' },
    } satisfies Omit<PledgeChatMessage, 'role'>;
  }

  return {
    content:
      '말씀해 주신 내용을 기록했어요. 금액, 기부 유형, 납부 시점이나 수단을 더 알려주시면 약정서에 작성할 수 있어요.',
  } satisfies Omit<PledgeChatMessage, 'role'>;
}
