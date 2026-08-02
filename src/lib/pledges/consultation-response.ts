import type {
  AiPledgePatch,
  PledgeConsultationResult,
  PledgeField,
} from './ai-schema';

const NEXT_QUESTIONS: Record<PledgeField, string> = {
  organization: '기부할 재단을 먼저 선택해 주세요.',
  amount: '기부하실 금액을 알려주세요.',
  donationDesignation:
    '특정 활동에 사용하는 지정 기부와 재단에 사용처를 맡기는 비지정 기부 중 어떤 방식으로 진행할까요?',
  donationCondition:
    '기부금을 어떤 재단 활동에 사용하면 좋을지 알려주세요. 재단 활동과 성과를 살펴보고 선택할 수도 있어요.',
  paymentSchedule: '기부금은 한 번에 납부하시겠어요, 나누어 납부하시겠어요?',
  paymentScheduleOther: '분할 납부 주기와 일정을 알려주세요.',
  paymentMethod:
    '온라인 납부, 직접 전달 또는 기타 방법 중 어떤 수단을 이용하시겠어요?',
  paymentMethodOther: '이용하실 납부 수단을 구체적으로 알려주세요.',
};

const FIELD_LABELS: Record<keyof AiPledgePatch, string> = {
  amount: '기부 금액',
  donationDesignation: '기부 유형',
  donationCondition: '기부 조건',
  paymentSchedule: '납부 시점',
  paymentScheduleOther: '분할 납부 일정',
  paymentMethod: '납부 수단',
  paymentMethodOther: '기타 납부 수단',
};

export function composeConsultationAssistantMessage(
  result: Pick<PledgeConsultationResult, 'proposedPatch' | 'nextQuestionField'>,
) {
  const appliedFields = Object.keys(result.proposedPatch).filter(
    (field): field is keyof AiPledgePatch => field in FIELD_LABELS,
  );
  const acknowledgement = appliedFields.length
    ? `${appliedFields.map((field) => FIELD_LABELS[field]).join(', ')}을 약정서에 작성했어요.`
    : '말씀해 주신 내용을 확인했어요.';
  if (!result.nextQuestionField)
    return `${acknowledgement} 필요한 약정 정보가 모두 작성됐어요. 다음 화면에서 전체 내용을 검토하고 수정할 수 있습니다.`;
  return `${acknowledgement} ${NEXT_QUESTIONS[result.nextQuestionField]}`;
}
