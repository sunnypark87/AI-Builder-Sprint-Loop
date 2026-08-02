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

  it('shows a load error without presenting it as an empty result', () => {
    render(
      <ManagementList
        activeStatus="all"
        basePath="/partner/executions"
        columns={[{ key: 'updatedAt', label: '최근 변경' }]}
        description="집행 내역 목록"
        error={{
          title: '집행 내역을 불러오지 못했습니다.',
          message: '잠시 후 다시 시도해 주세요.',
        }}
        rows={[]}
        statusFilters={[{ key: 'all', label: '전체' }]}
        title="집행 내역"
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain(
      '집행 내역을 불러오지 못했습니다.',
    );
    expect(screen.queryByText('해당 상태의 업무가 없습니다.')).toBeNull();
  });
});
