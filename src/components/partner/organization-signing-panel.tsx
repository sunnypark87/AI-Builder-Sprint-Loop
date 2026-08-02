'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { PledgeStatusSyncButton } from '@/components/pledges/pledge-status-sync-button';
import { SignatureStatusWatcher } from '@/components/pledges/signature-status-watcher';

export function OrganizationSigningPanel({
  pledgeId,
  available,
}: {
  pledgeId: string;
  available: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleSignatureAdvanced = useCallback(() => {
    setUrl(null);
    router.refresh();
  }, [router]);

  async function openSigning() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/pledges/${pledgeId}/signature-link`, {
      body: JSON.stringify({ role: 'organization' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) {
      setError('재단 서명 링크를 발급하지 못했습니다.');
      setLoading(false);
      return;
    }
    const result = (await response.json()) as { embeddedUrl: string };
    setUrl(result.embeddedUrl);
    setLoading(false);
  }

  return (
    <div className="mt-8 grid gap-5">
      <InlineNotice
        title="기부자 서명 확인"
        tone={available ? 'info' : 'warning'}
      >
        {available
          ? '기부자의 서명이 확인되었습니다. 약정 내용을 확인한 뒤 재단 서명을 진행하세요.'
          : '기부자의 서명이 완료된 뒤 재단 서명을 진행할 수 있습니다.'}
      </InlineNotice>
      {url ? (
        <>
          <iframe
            className="min-h-[720px] w-full border border-line bg-panel"
            title="모두싸인 기부재단 서명"
            src={url}
          />
          <SignatureStatusWatcher
            onAdvanced={handleSignatureAdvanced}
            pledgeId={pledgeId}
            role="organization"
          />
          <div className="flex justify-end">
            <PledgeStatusSyncButton pledgeId={pledgeId} role="organization" />
          </div>
        </>
      ) : (
        <Button
          disabled={!available}
          loading={loading}
          onClick={openSigning}
          size="large"
        >
          모두싸인에서 재단 서명하기
        </Button>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
