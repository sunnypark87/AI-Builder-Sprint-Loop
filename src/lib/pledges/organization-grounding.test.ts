import { describe, expect, it } from 'vitest';

import { validateOrganizationGrounding } from './organization-grounding';

const organization = {
  id: 'org-1',
  name: '해봄',
  description: '아동과 청소년의 교육을 지원합니다.',
  activityAreas: ['아동 교육', '청소년 자립'],
  supportedPrograms: ['진로 교육'],
  donationPolicy: '지정 기부는 등록된 사업에 사용합니다.',
};

describe('organization grounding', () => {
  it('accepts evidence that exists in registered organization data', () => {
    expect(
      validateOrganizationGrounding(
        {
          activities: [
            {
              text: '아동 교육',
              evidence: [{ field: 'activityAreas', value: '아동 교육' }],
            },
          ],
          conditionalDonationAreas: [],
          needsConfirmation: [],
        },
        organization,
      ),
    ).toEqual({ ok: true });
  });

  it('accepts a phrase contained in a registered composite program entry', () => {
    expect(
      validateOrganizationGrounding(
        {
          activities: [],
          conditionalDonationAreas: [
            {
              text: '교육·학습 지원',
              evidence: [
                { field: 'supportedPrograms', value: '교육·학습 지원' },
              ],
            },
          ],
          needsConfirmation: [],
        },
        {
          ...organization,
          supportedPrograms: [
            '교육·학습 지원: 취약계층 아동 지원 (지정 기부 예시: 교재비)',
          ],
        },
      ),
    ).toEqual({ ok: true });
  });

  it('rejects fabricated activities', () => {
    const result = validateOrganizationGrounding(
      {
        activities: [
          {
            text: '해외 의료',
            evidence: [{ field: 'activityAreas', value: '해외 의료' }],
          },
        ],
        conditionalDonationAreas: [],
        needsConfirmation: [],
      },
      organization,
    );
    expect(result.ok).toBe(false);
  });
});
