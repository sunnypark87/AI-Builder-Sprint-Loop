'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

const MAX_SYNC_ATTEMPTS = 10;
const SYNC_INTERVAL_MS = 2_500;

export function PledgeStatusSyncButton({
  pledgeId,
  role = 'donor',
}: {
  pledgeId: string;
  role?: 'donor' | 'organization';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMessage('모두싸인에서 서명 처리 상태를 확인하고 있어요.');

    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      const response = await fetch(`/api/pledges/${pledgeId}/sync`, {
        body: JSON.stringify({ role }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const result = (await response.json().catch(() => null)) as {
        status?: string;
      } | null;

      if (response.ok && hasSignatureAdvanced(role, result?.status)) {
        setMessage('서명 처리가 확인됐어요. 화면을 새로고침합니다.');
        router.refresh();
        setLoading(false);
        return;
      }

      if (attempt < MAX_SYNC_ATTEMPTS - 1) {
        await wait(SYNC_INTERVAL_MS);
      }
    }

    setMessage('서명 처리가 아직 진행 중이에요. 잠시 후 다시 확인해 주세요.');
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="grid justify-items-end gap-2">
      <Button loading={loading} onClick={() => void sync()} variant="secondary">
        {loading ? '서명 처리 확인 중' : '서명 상태 새로고침'}
      </Button>
      {message ? (
        <p aria-live="polite" className="text-right text-sm text-copy-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function hasSignatureAdvanced(
  role: 'donor' | 'organization',
  status?: string,
) {
  if (!status) return false;

  return role === 'donor'
    ? status !== 'awaiting_donor_signature'
    : status !== 'awaiting_organization_signature';
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
