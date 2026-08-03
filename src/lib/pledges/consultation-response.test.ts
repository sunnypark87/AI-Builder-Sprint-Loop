import { describe, expect, it } from 'vitest';

import { composeConsultationAssistantMessage } from './consultation-response';

describe('consultation assistant response', () => {
  it('acknowledges applied fields and asks the server-selected next question', () => {
    expect(
      composeConsultationAssistantMessage({
        proposedPatch: { amount: 100000 },
        nextQuestionField: 'donationDesignation',
      }),
    ).toBe(
      '기부 금액을 약정서에 작성했어요. 특정 활동에 사용하는 지정 기부와 재단에 사용처를 맡기는 비지정 기부 중 어떤 방식으로 진행할까요?',
    );
  });

  it('guides the donor to review when all required fields are complete', () => {
    expect(
      composeConsultationAssistantMessage({
        proposedPatch: { paymentMethod: 'online' },
        nextQuestionField: null,
      }),
    ).toContain('필요한 약정 정보가 모두 작성됐어요');
  });

  it('does not claim a field was written when the model extracted no patch', () => {
    expect(
      composeConsultationAssistantMessage({
        proposedPatch: {},
        nextQuestionField: 'amount',
      }),
    ).toBe('말씀해 주신 내용을 확인했어요. 기부하실 금액을 알려주세요.');
  });

  it('explains when an ungrounded condition was left for donor confirmation', () => {
    expect(
      composeConsultationAssistantMessage({
        proposedPatch: { donationDesignation: 'designated' },
        groundingWarnings: [
          '지정 기부 조건은 승인된 기부처 사업이나 허용 조건에서 선택해 주세요.',
        ],
        nextQuestionField: 'donationCondition',
      }),
    ).toContain('승인된 기부처 사업이나 허용 조건에서 선택해 주세요.');
  });
});
