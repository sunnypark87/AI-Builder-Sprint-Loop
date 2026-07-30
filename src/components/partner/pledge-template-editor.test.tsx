// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PledgeTemplateEditor } from './pledge-template-editor';

afterEach(cleanup);

describe('PledgeTemplateEditor', () => {
  it('updates the pledge preview and manages a custom clause', async () => {
    const user = userEvent.setup();
    render(<PledgeTemplateEditor mode="settings" />);

    const organizationName = screen.getByRole('textbox', {
      name: '약정서에 표시할 기부처명',
    });
    await user.clear(organizationName);
    await user.type(organizationName, '새봄재단');

    expect(screen.getByText(/새봄재단에 기부할 것을 약정합니다/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '조항 추가' }));
    const clause = screen.getByRole('textbox', { name: '추가 조항 2' });
    await user.type(clause, '기부자에게 분기별 집행 내역을 공개합니다.');
    expect(
      screen
        .getAllByText(/기부자에게 분기별 집행 내역을 공개합니다\./)
        .some((element) => element.tagName === 'LI'),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: '추가 조항 2 삭제' }));
    expect(screen.queryByRole('textbox', { name: '추가 조항 2' })).toBeNull();
  });
});
