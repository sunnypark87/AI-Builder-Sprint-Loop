// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { ImpactSummaryPanel } from './impact-summary-panel';

describe('ImpactSummaryPanel', () => {
  it('labels source-grounded AI impact guidance and exposes an accessible control', () => {
    const html = renderToStaticMarkup(
      <ImpactSummaryPanel organizationId="haebom" />,
    );
    expect(html).toContain('등록된 보고서에 근거한 AI 성과 요약');
    expect(html).toContain('재단 활동과 성과 보기');
    expect(html).toContain('aria-expanded="false"');
  });

  it('shows the demo summary after loading the API response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          summary: {
            overview: '교육취약 아동을 지원합니다.',
            reportingPeriod: '2025',
            limitations: [],
          },
          programs: [
            {
              id: 'program-1',
              programKey: 'education-gap',
              name: '교육격차 해소사업',
              description: '학습을 지원합니다.',
              suggestedConditions: ['학습비 지원'],
              facts: [
                {
                  id: 'fact-1',
                  metricType: 'output',
                  label: '지원 아동',
                  value: 1460,
                  unit: '명',
                  reportingPeriod: '2025',
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const { getByRole, findByText } = render(
      <ImpactSummaryPanel organizationId="haebom" />,
    );
    getByRole('button', { name: '재단 활동과 성과 보기' }).click();
    expect(await findByText('교육취약 아동을 지원합니다.')).toBeTruthy();
    expect(await findByText(/지원 아동/)).toBeTruthy();
    expect(await findByText(/1,460/)).toBeTruthy();
    fetchMock.mockRestore();
  });
});
