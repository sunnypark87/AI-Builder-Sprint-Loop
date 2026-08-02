'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { SignatureStatusWatcher } from '@/components/pledges/signature-status-watcher';

export function DonorSigningPanel({ pledgeId }: { pledgeId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState(
    '모두싸인 서명 화면을 준비하고 있습니다.',
  );
  const [loading, setLoading] = useState(true);
  const handleSignatureAdvanced = useCallback(() => {
    router.replace(`/pledges/${pledgeId}/waiting`);
  }, [pledgeId, router]);

  useEffect(() => {
    void (async () => {
      const request = await fetch(
        `/api/pledges/${pledgeId}/signature-request`,
        { method: 'POST' },
      );
      if (request.status === 202) {
        setMessage('서명 요청을 준비 중입니다. 잠시 후 다시 시도해 주세요.');
        setLoading(false);
        return;
      }
      if (!request.ok && request.status !== 200) {
        const result = (await request.json().catch(() => null)) as {
          code?: string;
          fields?: string[];
        } | null;
        if (
          result?.code === 'donor_signature_unavailable' ||
          result?.code === 'signature_already_completed'
        ) {
          router.replace(`/pledges/${pledgeId}/waiting`);
          return;
        }
        setMessage(getSignatureRequestErrorMessage(result));
        setLoading(false);
        return;
      }
      const link = await fetch(`/api/pledges/${pledgeId}/signature-link`, {
        body: JSON.stringify({ role: 'donor' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (!link.ok) {
        const result = (await link.json().catch(() => null)) as {
          code?: string;
        } | null;
        if (result?.code === 'signature_already_completed') {
          router.replace(`/pledges/${pledgeId}/waiting`);
          return;
        }
        setMessage(
          result?.code === 'signature_link_failed'
            ? '모두싸인 임베디드 서명 링크를 발급하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : getSignatureRequestErrorMessage(result),
        );
        setLoading(false);
        return;
      }
      const result = (await link.json()) as { embeddedUrl: string };
      setUrl(result.embeddedUrl);
      setLoading(false);
    })();
  }, [pledgeId, router]);

  return (
    <div className="mt-8 grid gap-5">
      <InlineNotice title="모두싸인 전자서명" tone="info">
        서명을 완료하면 기부재단에 약정서가 전달되고, 재단 서명 대기 상태로
        이동합니다.
      </InlineNotice>
      {url ? (
        <>
          <iframe
            className="min-h-[720px] w-full border border-line bg-panel"
            title="모두싸인 기부자 서명"
            src={url}
          />
          <SignatureStatusWatcher
            onAdvanced={handleSignatureAdvanced}
            pledgeId={pledgeId}
            role="donor"
          />
        </>
      ) : (
        <p className="border border-line p-8 text-center text-sm text-copy-muted">
          {message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          onClick={() => router.push(`/pledges/${pledgeId}/waiting`)}
          variant="secondary"
        >
          서명 완료 후 상태 확인
        </Button>
        {loading ? (
          <Button disabled loading>
            준비 중
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function getSignatureRequestErrorMessage(
  result: {
    code?: string;
    fields?: string[];
  } | null,
) {
  switch (result?.code) {
    case 'pledge_incomplete':
      return `서명 전에 약정서 필수 항목을 확인해 주세요: ${formatMissingFields(result.fields)}`;
    case 'organization_signer_missing':
      return '기부처 서명자의 이름과 이메일이 등록되지 않아 서명 요청을 만들 수 없습니다.';
    case 'organization_signer_account_mismatch':
      return '기부처 대표 서명자와 로그인 계정의 연결 정보가 일치하지 않습니다.';
    case 'donor_signer_email_missing':
      return '기부자 로그인 계정의 이메일을 확인할 수 없습니다.';
    case 'signature_reconciliation_required':
      return '이전 서명 요청의 처리 결과를 확인하는 중입니다. 잠시 후 상태를 새로고침해 주세요.';
    case 'invalid_pledge_state':
      return '현재 약정서 상태에서는 서명을 시작할 수 없습니다. 약정서 상태를 새로고침해 주세요.';
    case 'identity_number_unavailable':
      return '주민등록번호 암호화 정보를 확인하지 못했습니다. 관리자에게 문의해 주세요.';
    case 'server_configuration_error':
      return '서명 서비스 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.';
    case 'modusign_auth_failed':
      return '모두싸인 인증에 실패했습니다. MODUSIGN_AUTH_KEY를 확인해 주세요.';
    case 'modusign_invalid_response':
      return '모두싸인 응답 형식이 예상과 다릅니다. 관리자에게 문의해 주세요.';
    case 'modusign_rate_limited':
      return '모두싸인 요청이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.';
    case 'modusign_timeout':
      return '모두싸인 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
    case 'modusign_request_failed':
      return '모두싸인 서명 요청이 거부되었습니다. 템플릿과 입력값을 확인해 주세요.';
    case 'signature_request_failed':
      return '서명 요청 처리 중 내부 오류가 발생했습니다. 관리자에게 문의해 주세요.';
    case 'donor_signature_unavailable':
      return '현재 약정서 상태에서는 기부자 서명을 진행할 수 없습니다.';
    case 'signature_already_completed':
      return '기부자 서명이 이미 완료되었습니다.';
    default:
      return '서명 요청을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

function formatMissingFields(fields?: string[]) {
  const labels: Record<string, string> = {
    amount: '기부 금액',
    donation_designation: '지정 여부',
    donation_kind: '기부 종류',
    donation_kind_other: '기타 기부 종류',
    donation_type: '기부 유형',
    donor_address: '주소',
    donor_contact: '연락처',
    donor_identity_number: '주민등록번호',
    donor_name: '기부자명',
    payment_method: '납부 방법',
    payment_method_other: '기타 납부 방법',
    payment_schedule: '납부 주기',
    payment_schedule_other: '기타 납부 주기',
    personal_info_consent: '개인정보 수집·이용 동의',
    pledge_date: '약정일',
    purpose: '기부 목적',
    third_party_info_consent: '개인정보 제3자 제공 동의',
  };

  return (fields || []).map((field) => labels[field] || field).join(', ');
}
