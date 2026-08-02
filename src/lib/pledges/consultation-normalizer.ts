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
