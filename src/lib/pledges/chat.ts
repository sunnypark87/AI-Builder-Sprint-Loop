export type PledgeChatRole = 'user' | 'assistant';

export type PledgeChatPatch = Partial<{
  amount: number;
  donationType: string;
  purpose: string;
  donationCondition: string;
}>;

export type PledgeChatMessage = {
  id?: string;
  role: PledgeChatRole;
  content: string;
  proposedPatch?: PledgeChatPatch;
  createdAt?: string;
};

export function createMockAssistantReply(message: string) {
  const normalized = message.replace(/\s/g, '');
  const amount = message.match(/(?:월|매달|매월)?\s*([0-9,]+)\s*만원/);
  const amountWon = amount
    ? Number(amount[1].replaceAll(',', '')) * 10_000
    : null;

  if (amountWon) {
    return {
      content: `기부 금액을 월 ${amountWon.toLocaleString('ko-KR')}원으로 제안할게요. 약정서에 반영하기 전에 확인해 주세요.`,
      proposedPatch: { amount: amountWon },
    } satisfies Omit<PledgeChatMessage, 'role'>;
  }

  if (normalized.includes('교육') || normalized.includes('목적')) {
    return {
      content:
        '기부 목적을 말씀해 주셨군요. 약정서의 기부 목적에 반영할 수 있도록 정리했어요.',
      proposedPatch: { purpose: message.trim() },
    } satisfies Omit<PledgeChatMessage, 'role'>;
  }

  if (normalized.includes('보고') || normalized.includes('공개')) {
    return {
      content:
        '집행 내역과 완료 보고를 안내받는 조건으로 정리했어요. 약정서에 반영할 수 있어요.',
      proposedPatch: {
        donationCondition: '계획·집행 내역·완료 보고 시 알림',
      },
    } satisfies Omit<PledgeChatMessage, 'role'>;
  }

  return {
    content:
      '말씀해 주신 내용을 기록했어요. 금액, 목적, 기간이나 집행 공개 조건을 더 알려주시면 약정서에 반영할 수 있어요.',
  } satisfies Omit<PledgeChatMessage, 'role'>;
}
