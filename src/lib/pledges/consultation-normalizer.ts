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
  const groundingErrors = validateDonationConditionGrounding(
    proposedPatch,
    input.organization,
  );
  if (groundingErrors.length) return { ok: false, errors: groundingErrors };
  const missingFields = getMissingPledgeFields(
    input.currentPledge,
    proposedPatch,
  );
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
    },
  };
}

function validateDonationConditionGrounding(
  patch: PledgeConsultationResult['proposedPatch'],
  organization: OrganizationAiContext,
) {
  if (
    patch.donationDesignation !== 'designated' ||
    !patch.donationCondition?.trim()
  )
    return [];
  const condition = normalize(patch.donationCondition);
  const grounded = (organization.programs ?? []).some((program) => {
    const candidates = [program.name, ...program.allowedConditions];
    return candidates.some((candidate) => {
      const normalized = normalize(candidate);
      return condition.includes(normalized) || normalized.includes(condition);
    });
  });
  return grounded
    ? []
    : ['지정 기부 조건이 승인된 기부처 사업 근거와 일치하지 않습니다.'];
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
  return value.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}
