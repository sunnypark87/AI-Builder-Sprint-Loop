import { NextResponse } from 'next/server';

import { ReportEvidenceError } from './report-evidence';
import { ReportRepositoryError } from './report-repository';
import { ReportServiceError } from './report-service';
import { AuthenticationError } from '@/lib/supabase/auth';
import { SupabaseConfigurationError } from '@/lib/supabase/server';

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function reportError(
  status: number,
  code: string,
  message: string,
  retryable = status >= 500,
  reportId: string | null = null,
) {
  return NextResponse.json(
    { error: { code, message, retryable }, reportId },
    { status },
  );
}

export function safeReportError(error: unknown) {
  if (error instanceof ReportServiceError) {
    return reportError(
      error.httpStatus,
      error.code,
      error.message,
      error.retryable,
      error.reportId,
    );
  }
  if (error instanceof ReportEvidenceError) {
    return reportError(422, error.code, error.message, false);
  }
  if (error instanceof ReportRepositoryError) {
    if (error.code === 'not_found' || error.code === 'forbidden') {
      return reportError(404, 'not_found', '보고서를 찾을 수 없습니다.', false);
    }
    if (error.code === 'conflict') {
      return reportError(
        409,
        'conflict',
        '동일한 보고서 요청이 이미 처리됐습니다.',
        false,
      );
    }
    if (error.code === 'invalid_evidence') {
      return reportError(
        422,
        'invalid_evidence',
        '보고서 근거를 확인할 수 없습니다.',
        false,
      );
    }
  }
  if (error instanceof AuthenticationError) {
    return reportError(401, 'unauthenticated', error.message, false);
  }
  if (error instanceof SupabaseConfigurationError) {
    return reportError(
      503,
      'service_unavailable',
      '보고서 저장소가 구성되지 않았습니다.',
      false,
    );
  }
  return reportError(
    500,
    'internal_error',
    '기부 보고서를 처리할 수 없습니다.',
    true,
  );
}
