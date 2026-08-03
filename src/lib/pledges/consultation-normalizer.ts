import type {
  OrganizationAiContext,
  ModelConsultationOutput,
  PledgeConsultationResult,
  PledgeField,
} from './ai-schema';
import {
  findPledgeConflicts,
  getMissingPledgeFields,
  selectNextQuestion,
  type ConsultationPledgeState,
} from './consultation';

export function normalizeConsultationResult(input: {
  modelOutput: ModelConsultationOutput;
  currentPledge: ConsultationPledgeState;
  organization: OrganizationAiContext;
}):
  | { ok: true; value: PledgeConsultationResult }
  | { ok: false; errors: string[] } {
  const proposedPatch = normalizePatch(input.modelOutput.proposedPatch);
  const groundingWarnings: string[] = [];
  const effectiveDesignation =
    proposedPatch.donationDesignation ??
    input.currentPledge.donationDesignation;
  const groundedCondition = resolveDonationCondition(
    effectiveDesignation === 'designated'
      ? proposedPatch.donationCondition
      : null,
    input.organization,
  );
  if (proposedPatch.donationCondition && !groundedCondition) {
    delete proposedPatch.donationCondition;
    groundingWarnings.push(
      '지정 기부 조건은 승인된 기부처 사업이나 허용 조건에서 선택해 주세요.',
    );
  } else if (groundedCondition) {
    proposedPatch.donationCondition = groundedCondition;
  }
  const missingFields = getMissingPledgeFields(
    input.currentPledge,
    proposedPatch,
  );
  if (
    groundingWarnings.length &&
    !missingFields.includes('donationCondition') &&
    effectiveDesignation === 'designated'
  ) {
    missingFields.push('donationCondition');
  }
  const conflictFields = findPledgeConflicts(
    input.currentPledge,
    proposedPatch,
  );
  const confirmationFields = Object.keys(proposedPatch).filter(
    (field): field is PledgeField => field !== 'organization',
  ) as PledgeField[];
  return {
    ok: true,
    value: {
      ...input.modelOutput,
      proposedPatch,
      missingFields,
      confirmationFields,
      conflictFields,
      nextQuestionField: selectNextQuestion(missingFields),
      groundingWarnings,
    },
  };
}

function resolveDonationCondition(
  condition: PledgeConsultationResult['proposedPatch']['donationCondition'],
  organization: OrganizationAiContext,
) {
  if (!condition?.trim()) return null;
  const normalizedInput = normalize(condition);
  for (const program of organization.programs ?? []) {
    if (normalizedInput === normalize(program.name)) return program.name;
    for (const allowedCondition of program.allowedConditions) {
      if (normalizedInput === normalize(allowedCondition))
        return allowedCondition;

      // Keep the demo's natural phrasing ("사업의 <조건>") while requiring
      // the actual condition to be a complete approved value.
      const programName = normalize(program.name);
      if (
        [
          `${programName}의${normalize(allowedCondition)}`,
          `${programName}사업의${normalize(allowedCondition)}`,
        ].includes(normalizedInput)
      )
        return allowedCondition;
    }
  }
  return null;
}

function normalizePatch(patch: ModelConsultationOutput['proposedPatch']) {
  const normalized = { ...patch };
  if (normalized.donationDesignation === 'undesignated')
    normalized.donationCondition = null;
  if (normalized.paymentSchedule && normalized.paymentSchedule !== 'other')
    normalized.paymentScheduleOther = null;
  if (normalized.paymentMethod && normalized.paymentMethod !== 'other')
    normalized.paymentMethodOther = null;
  return normalized;
}

function normalize(value: string) {
  return value.replace(/[^\p{L}\p{N}]+/gu, '').toLocaleLowerCase('ko-KR');
}
