import { parseAndValidateReportContent } from './report-schema';
import type { ReportRepository } from './report-repository';
import type { ReportEvidence, SolarReportMetadata } from './types';
import { generateSolarReport, SolarChatError } from '@/lib/upstage/solar-chat';

export class ReportServiceError extends Error {
  constructor(
    public readonly code:
      | 'invalid_request'
      | 'not_found'
      | 'generation_failed'
      | 'invalid_status'
      | 'conflict',
    message: string,
    public readonly httpStatus: number,
    public readonly retryable = false,
    public readonly reportId: string | null = null,
  ) {
    super(message);
    this.name = 'ReportServiceError';
  }
}

type Generator = (evidence: ReportEvidence) => Promise<{
  content: unknown;
  metadata: SolarReportMetadata;
}>;

async function generateAndSave(
  reportId: string,
  evidence: ReportEvidence,
  leaseToken: string,
  repository: ReportRepository,
  generator: Generator,
) {
  try {
    const generated = await generator(evidence);
    const parsed = parseAndValidateReportContent(generated.content, evidence);
    if (!parsed.content || parsed.issues.length > 0) {
      throw new SolarChatError(
        'invalid_response',
        'AI 보고서가 근거 검증을 통과하지 못했습니다.',
        true,
      );
    }
    await repository.saveGeneration(
      reportId,
      leaseToken,
      parsed.content,
      generated.metadata,
    );
    return parsed.content;
  } catch (error) {
    const code =
      error instanceof SolarChatError ? error.code : 'generation_failed';
    try {
      await repository.markGenerationFailed(reportId, leaseToken, code);
    } catch {
      // Preserve the sanitized generation error even if failure recording races.
    }
    if (error instanceof SolarChatError) {
      throw new ReportServiceError(
        'generation_failed',
        error.message,
        error.status && error.status < 500 ? error.status : 502,
        error.retryable,
        reportId,
      );
    }
    throw new ReportServiceError(
      'generation_failed',
      'AI 보고서 초안을 생성할 수 없습니다.',
      500,
      true,
      reportId,
    );
  }
}

export async function createDonationReport(
  input: {
    donationId: string;
    planId: string;
    idempotencyKey: string;
  },
  dependencies: {
    repository: ReportRepository;
    generator?: Generator;
  },
) {
  const evidence = await dependencies.repository.buildEvidence(
    input.donationId,
    input.planId,
  );
  const started = await dependencies.repository.begin({
    evidence,
    title: `${evidence.plan.title} 완료 보고`,
    idempotencyKey: input.idempotencyKey,
  });
  if (!started.shouldGenerate || !started.leaseToken) {
    return {
      reportId: started.id,
      status: started.status,
      duplicate: true,
    };
  }
  await generateAndSave(
    started.id,
    started.evidence,
    started.leaseToken,
    dependencies.repository,
    dependencies.generator ?? generateSolarReport,
  );
  return {
    reportId: started.id,
    status: 'review_required' as const,
    duplicate: false,
  };
}

export async function retryDonationReport(
  reportId: string,
  dependencies: { repository: ReportRepository; generator?: Generator },
) {
  const claim = await dependencies.repository.claimRetry(reportId);
  if (!claim) {
    throw new ReportServiceError(
      'invalid_status',
      '현재 상태에서는 보고서 생성을 다시 시도할 수 없습니다.',
      409,
    );
  }
  await generateAndSave(
    reportId,
    claim.evidence,
    claim.leaseToken,
    dependencies.repository,
    dependencies.generator ?? generateSolarReport,
  );
  return { reportId, status: 'review_required' as const };
}
