'use client';

import { useEffect, useState } from 'react';

import { hasSignatureAdvanced } from './pledge-status-sync-button';

const DATABASE_POLL_MS = 2_000;
const PROVIDER_SYNC_MS = 10_000;
const AUTO_WATCH_MS = 2 * 60 * 1000;

export function SignatureStatusWatcher({
  onAdvanced,
  pledgeId,
  role,
}: {
  onAdvanced: () => void;
  pledgeId: string;
  role: 'donor' | 'organization';
}) {
  const [message, setMessage] = useState(
    '모두싸인 서명 완료를 기다리고 있어요.',
  );

  useEffect(() => {
    let stopped = false;

    async function readStatus() {
      if (stopped || document.visibilityState === 'hidden') return;

      try {
        const response = await fetch(
          `/api/pledges/${pledgeId}/signature-status?role=${role}`,
          { cache: 'no-store' },
        );
        const result = (await response.json().catch(() => null)) as {
          status?: string;
        } | null;

        if (
          !stopped &&
          response.ok &&
          hasSignatureAdvanced(role, result?.status)
        ) {
          stopped = true;
          setMessage('서명 처리가 확인됐어요.');
          onAdvanced();
        }
      } catch {
        // A later poll or the manual status action remains available.
      }
    }

    async function syncProvider() {
      if (stopped || document.visibilityState === 'hidden') return;

      setMessage('모두싸인에서 서명 처리 상태를 확인하고 있어요.');
      try {
        await fetch(`/api/pledges/${pledgeId}/sync`, {
          body: JSON.stringify({ role }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });
      } catch {
        // The next scheduled sync can recover from a transient network error.
      }
      await readStatus();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') void readStatus();
    }

    void readStatus();
    const databaseTimer = window.setInterval(
      () => void readStatus(),
      DATABASE_POLL_MS,
    );
    const providerTimer = window.setInterval(
      () => void syncProvider(),
      PROVIDER_SYNC_MS,
    );
    const deadlineTimer = window.setTimeout(() => {
      stopped = true;
      setMessage(
        '자동 확인을 멈췄어요. 서명을 완료했다면 상태 새로고침을 눌러 주세요.',
      );
    }, AUTO_WATCH_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(databaseTimer);
      window.clearInterval(providerTimer);
      window.clearTimeout(deadlineTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onAdvanced, pledgeId, role]);

  return (
    <p aria-live="polite" className="text-sm text-copy-muted">
      {message}
    </p>
  );
}
