import { describe, expect, it } from 'vitest';

import { createMockAssistantReply } from './chat';

describe('mock pledge chat', () => {
  it('returns an automatically applied amount extraction without calling an AI service', () => {
    expect(createMockAssistantReply('월 5만원씩 기부하고 싶어요')).toEqual({
      content:
        '기부 금액을 월 50,000원으로 약정서에 작성했어요. 다음 검토 화면에서 수정할 수 있어요.',
      proposedPatch: { amount: 50000 },
    });
  });

  it('creates a designated donation condition extraction', () => {
    expect(
      createMockAssistantReply('청소년 교육 사업에 지정하고 싶어요'),
    ).toEqual({
      content:
        '지정 기부 조건으로 약정서에 작성했어요. 다음 검토 화면에서 수정할 수 있어요.',
      proposedPatch: {
        donationCondition: '청소년 교육 사업에 지정하고 싶어요',
      },
    });
  });

  it('creates an undesignated donation proposal without a condition', () => {
    expect(createMockAssistantReply('재단에서 필요한 곳에 써 주세요')).toEqual({
      content: '비지정 기부로 정리했어요. 기부 조건은 작성하지 않습니다.',
      proposedPatch: { donationDesignation: 'undesignated' },
    });
  });
});
