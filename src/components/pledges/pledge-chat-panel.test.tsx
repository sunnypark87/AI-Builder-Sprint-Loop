import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PledgeChatPanel } from './pledge-chat-panel';

describe('PledgeChatPanel', () => {
  it('presents the AI pledge helper conversation with accessible live updates', () => {
    const html = renderToStaticMarkup(
      <PledgeChatPanel
        initialMessages={[
          {
            content: '기부 금액을 알려주세요.',
            nextQuestionField: 'amount',
            role: 'assistant',
          },
        ]}
      />,
    );
    expect(html).toContain('약정 작성 대화');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('5만원을 기부할게요');
    expect(html).not.toContain('집행 내역을 보고받고 싶어요');
  });

  it('keeps the conversation smooth without showing internal extraction details', () => {
    const html = renderToStaticMarkup(
      <PledgeChatPanel
        initialMessages={[
          {
            content: '지정 기부로 제안할게요.',
            missingFields: ['paymentMethod'],
            nextQuestionField: 'paymentMethod',
            proposedPatch: { donationDesignation: 'designated' },
            role: 'assistant',
          },
        ]}
      />,
    );
    expect(html).toContain('온라인으로 납부할게요');
    expect(html).not.toContain('약정서에 작성된 내용');
    expect(html).not.toContain('추가로 확인할 항목');
    expect(html).not.toContain('자동 저장');
  });
});
