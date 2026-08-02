'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { PledgeChatPanel } from '@/components/pledges/pledge-chat-panel';
import { Button } from '@/components/ui/button';
import type { PledgeChatMessage } from '@/lib/pledges/chat';

export function ConsultationWorkspace({
  organizationId,
  initialMessages,
}: {
  organizationId: string;
  initialMessages: PledgeChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPledge() {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/pledges', {
      body: JSON.stringify({
        organizationSlug: organizationId,
        conversationMessages: messages,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (response.status === 401) {
      router.push(`/login?next=/donate/${organizationId}/consultation`);
      return;
    }
    if (!response.ok) {
      setError('약정서를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setLoading(false);
      return;
    }
    const result = (await response.json()) as { pledgeId: string };
    router.push(`/pledges/${result.pledgeId}/review`);
  }

  return (
    <div className="mt-8 grid gap-5">
      <PledgeChatPanel
        initialMessages={initialMessages}
        onMessagesChange={setMessages}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {error ? <p className="mr-auto text-sm text-danger">{error}</p> : null}
        <Button
          loading={loading}
          onClick={() => void openPledge()}
          size="large"
        >
          약정서 확인하기
        </Button>
      </div>
    </div>
  );
}
