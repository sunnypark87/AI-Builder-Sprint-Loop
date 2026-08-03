import { describe, expect, it } from 'vitest';
import { parseUpstageChatResponse } from './chat-response';

const output = {
  assistantMessage: '확인해 주세요.',
  proposedPatch: { amount: 100000 },
};

describe('upstage chat response', () => {
  it('parses and validates the assistant JSON content', () => {
    expect(
      parseUpstageChatResponse({
        choices: [{ message: { content: JSON.stringify(output) } }],
      }),
    ).toEqual(output);
  });
  it('rejects non-JSON content and empty choices', () => {
    expect(() => parseUpstageChatResponse({ choices: [] })).toThrow(
      '응답 형식',
    );
    expect(() =>
      parseUpstageChatResponse({
        choices: [{ message: { content: 'not json' } }],
      }),
    ).toThrow('JSON');
  });

  it('recovers a valid assistant message when one patch field is malformed', () => {
    expect(
      parseUpstageChatResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                assistantMessage: '금액을 다시 확인해 주세요.',
                proposedPatch: { amount: '10만원', paymentMethod: 'online' },
              }),
            },
          },
        ],
      }),
    ).toEqual({
      assistantMessage: '금액을 다시 확인해 주세요.',
      proposedPatch: { paymentMethod: 'online' },
    });
  });
});
