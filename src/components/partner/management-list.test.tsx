// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';

import { ManagementList } from './management-list';

afterEach(cleanup);

function Counter({ label }: { label: string }) {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount((value) => value + 1)} type="button">
      {label} {count}
    </button>
  );
}

function rows(order: string[]) {
  return order.map((id) => ({
    id,
    title: '이름 없는 집행 계획',
    description: `${id} 설명`,
    status: '분석 실패',
    statusKey: 'analysis_failed',
    action: <Counter label={id} />,
    cells: { updatedAt: '오늘' },
  }));
}

function list(rowsValue: ReturnType<typeof rows>) {
  return (
    <ManagementList
      activeStatus="all"
      basePath="/partner/plans"
      columns={[{ key: 'updatedAt', label: '최근 변경' }]}
      description="집행 계획 목록"
      rows={rowsValue}
      statusFilters={[
        { key: 'all', label: '전체' },
        { key: 'analysis_failed', label: '분석 실패' },
      ]}
      title="집행 계획"
    />
  );
}

describe('ManagementList', () => {
  it('keeps row action state with its immutable id when duplicate titles reorder', async () => {
    const user = userEvent.setup();
    const { rerender } = render(list(rows(['plan-a', 'plan-b'])));

    await user.click(screen.getByRole('button', { name: 'plan-a 0' }));
    expect(screen.getByRole('button', { name: 'plan-a 1' })).toBeTruthy();

    rerender(list(rows(['plan-b', 'plan-a'])));

    expect(screen.getByRole('button', { name: 'plan-a 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'plan-b 0' })).toBeTruthy();
  });
});
