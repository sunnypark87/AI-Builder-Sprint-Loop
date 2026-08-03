import type { PledgeField } from './ai-schema';

export type SuggestedReply = {
  id: string;
  label: string;
  message: string;
};

export function getSuggestedReplies(
  nextQuestionField: PledgeField | string | null | undefined,
): SuggestedReply[] {
  switch (nextQuestionField) {
    case 'amount':
      return [
        reply('amount-50k', '5만원을 기부할게요', '5만원을 기부할게요'),
        reply('amount-100k', '10만원을 기부할게요', '10만원을 기부할게요'),
      ];
    case 'donationDesignation':
      return [
        reply(
          'designation-designated',
          '지정 기부로 할게요',
          '지정 기부로 할게요',
        ),
        reply(
          'designation-undesignated',
          '비지정 기부로 할게요',
          '비지정 기부로 할게요',
        ),
      ];
    case 'donationCondition':
      return [
        reply(
          'condition-recommend',
          '재단의 주요 활동을 추천해 주세요',
          '재단의 주요 활동을 추천해 주세요',
        ),
        reply(
          'condition-custom',
          '기부 조건을 직접 작성할게요',
          '기부 조건을 직접 작성할게요',
        ),
      ];
    case 'paymentSchedule':
      return [
        reply('schedule-lump-sum', '일시 납부할게요', '일시 납부할게요'),
        reply('schedule-other', '분할 납부하고 싶어요', '분할 납부하고 싶어요'),
      ];
    case 'paymentScheduleOther':
      return [
        reply(
          'schedule-monthly',
          '매월 분할 납부할게요',
          '매월 분할 납부할게요',
        ),
        reply(
          'schedule-quarterly',
          '분기별로 납부할게요',
          '분기별로 납부할게요',
        ),
      ];
    case 'paymentMethod':
      return [
        reply(
          'method-online',
          '온라인으로 납부할게요',
          '온라인으로 납부할게요',
        ),
        reply('method-direct', '직접 전달할게요', '직접 전달할게요'),
        reply(
          'method-other',
          '기타 수단을 사용할게요',
          '기타 수단을 사용할게요',
        ),
      ];
    case 'paymentMethodOther':
      return [
        reply(
          'method-transfer',
          '계좌이체로 납부할게요',
          '계좌이체로 납부할게요',
        ),
      ];
    default:
      return [
        reply('amount-start', '5만원을 기부할게요', '5만원을 기부할게요'),
        reply(
          'designation-start',
          '기부 유형부터 정할게요',
          '기부 유형부터 정할게요',
        ),
      ];
  }
}

function reply(id: string, label: string, message: string): SuggestedReply {
  return { id, label, message };
}
