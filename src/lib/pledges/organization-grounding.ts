import type { OrganizationAiContext } from './ai-schema';

type OrganizationSummary = {
  activities: GroundedSummaryItem[];
  conditionalDonationAreas: GroundedSummaryItem[];
  needsConfirmation: string[];
};
type GroundedSummaryItem = {
  text: string;
  evidence: Array<{
    field:
      'description' | 'activityAreas' | 'supportedPrograms' | 'donationPolicy';
    value: string;
  }>;
};

export type GroundingError = { path: string; message: string };

export function validateOrganizationGrounding(
  summary: OrganizationSummary | undefined,
  organization: OrganizationAiContext,
): { ok: true } | { ok: false; errors: GroundingError[] } {
  if (!summary) return { ok: true };
  const errors: GroundingError[] = [];
  for (const [group, items] of [
    ['activities', summary.activities],
    ['conditionalDonationAreas', summary.conditionalDonationAreas],
  ] as const) {
    items.forEach((item, index) => {
      item.evidence.forEach((evidence, evidenceIndex) => {
        const source = organization[evidence.field];
        const grounded = Array.isArray(source)
          ? source.some((value) =>
              normalize(value).includes(normalize(evidence.value)),
            )
          : typeof source === 'string' &&
            normalize(source).includes(normalize(evidence.value));
        if (!grounded) {
          errors.push({
            path: `organizationSummary.${group}.${index}.evidence.${evidenceIndex}`,
            message: '등록된 기부처 정보에서 확인되지 않는 근거입니다.',
          });
        }
      });
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

function normalize(value: string) {
  return value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}
