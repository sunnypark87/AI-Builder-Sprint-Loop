// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PublishConfirmation } from './publish-confirmation';

afterEach(cleanup);

function renderConfirmation() {
  return render(
    <div>
      <button type="button">대화상자 밖의 작업</button>
      <PublishConfirmation
        triggerLabel="보고서 발행"
        title="보고서를 발행할까요?"
        description="발행하면 기부자에게 알림이 전송됩니다."
        confirmLabel="발행하고 알림 보내기"
        href="/partner/reports"
      />
    </div>,
  );
}

describe('PublishConfirmation', () => {
  it('opens an accessible modal, traps focus, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup();
    renderConfirmation();
    const trigger = screen.getByRole('button', { name: '보고서 발행' });

    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '보고서를 발행할까요?' });
    expect(dialog).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(
      within(dialog).getByText('발행하면 기부자에게 알림이 전송됩니다.'),
    ).toBeTruthy();

    for (let index = 0; index < 5; index += 1) await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes through the review action without navigating', async () => {
    const user = userEvent.setup();
    renderConfirmation();

    await user.click(screen.getByRole('button', { name: '보고서 발행' }));
    await user.click(screen.getByRole('button', { name: '계속 검토' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
