// @vitest-environment jsdom

import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsultationWorkspace } from './consultation-workspace';

const replace = vi.fn();

HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));

describe('consultation workspace', () => {
  it('stores the created draft id in the URL for reload recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ pledgeId: 'pledge-1' }), {
          status: 201,
        }),
      ),
    );
    replace.mockClear();

    const { getByRole } = render(
      <ConsultationWorkspace
        initialMessages={[
          { content: '상담을 시작해 주세요.', role: 'assistant' },
        ]}
        organizationId="haebom"
      />,
    );

    fireEvent.change(getByRole('textbox', { name: 'AI에게 메시지 보내기' }), {
      target: { value: '5만원을 기부할게요' },
    });
    fireEvent.click(getByRole('button', { name: '보내기' }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/?pledgeId=pledge-1'),
    );
  });
});
