import { describe, expect, it } from 'vitest';

import { createMockAssistantReply } from './chat';

describe('mock pledge chat', () => {
  it('returns a reviewable amount proposal without calling an AI service', () => {
    expect(createMockAssistantReply('월 5만원씩 기부하고 싶어요')).toEqual({
      content:
        '기부 금액을 월 50,000원으로 제안할게요. 약정서에 반영하기 전에 확인해 주세요.',
      proposedPatch: { amount: 50000 },
    });
  });

  it('keeps an unstructured message as conversation context', () => {
    expect(createMockAssistantReply('아직 잘 모르겠어요')).toEqual({
      content:
        '말씀해 주신 내용을 기록했어요. 금액, 목적, 기간이나 집행 공개 조건을 더 알려주시면 약정서에 반영할 수 있어요.',
    });
  });
});
