// @vitest-environment jsdom

import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { EditablePledge } from './pledge-document-form';
import {
  mergePledgeChatPatch,
  PledgeReviewWorkspace,
} from './pledge-review-workspace';

HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('pledge review workspace', () => {
  it('synchronizes an automatically applied AI patch and pledge version', () => {
    const pledge = {
      amount: 100000,
      donation_designation: null,
      payment_method: null,
      version: 3,
    } as EditablePledge;

    expect(
      mergePledgeChatPatch(
        pledge,
        { amount: 250000, paymentMethod: 'online' },
        4,
      ),
    ).toMatchObject({
      amount: 250000,
      payment_method: 'online',
      version: 4,
    });
  });

  it('merges only AI fields without replacing unrelated unsaved form fields', () => {
    const pledge = {
      amount: 100000,
      donor_name: '기부자',
      donation_designation: null,
      payment_method: null,
      version: 3,
    } as EditablePledge;

    expect(
      mergePledgeChatPatch(pledge, { paymentMethod: 'online' }, 4),
    ).toMatchObject({
      amount: 100000,
      donor_name: '기부자',
      payment_method: 'online',
      version: 4,
    });
  });

  it('preserves chat messages after collapsing and reopening the panel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            userMessage: { content: '추가 질문', role: 'user' },
            assistantMessage: { content: '답변', role: 'assistant' },
            appliedPatch: {},
            missingFields: [],
            nextQuestionField: null,
          }),
          { status: 200 },
        ),
      ),
    );
    const { getByRole, getByText } = render(
      <PledgeReviewWorkspace
        messages={[{ content: '기존 대화', role: 'assistant' }]}
        pledge={
          {
            id: 'pledge-1',
            version: 1,
            status: 'draft',
          } as unknown as EditablePledge
        }
      />,
    );

    fireEvent.change(getByRole('textbox', { name: 'AI에게 메시지 보내기' }), {
      target: { value: '추가 질문' },
    });
    fireEvent.click(getByRole('button', { name: '보내기' }));
    await waitFor(() => expect(getByText('답변')).toBeTruthy());

    fireEvent.click(getByRole('button', { name: 'AI 대화창 접기' }));
    fireEvent.click(getByRole('button', { name: 'AI 대화 펼치기' }));

    expect(getByText('추가 질문')).toBeTruthy();
    expect(getByText('답변')).toBeTruthy();
  });
});
