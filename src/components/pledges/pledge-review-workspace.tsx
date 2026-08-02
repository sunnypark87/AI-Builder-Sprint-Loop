'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PledgeChatPanel } from '@/components/pledges/pledge-chat-panel';
import {
  PledgeDocumentForm,
  type EditablePledge,
} from '@/components/pledges/pledge-document-form';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { PledgeChatMessage, PledgeChatPatch } from '@/lib/pledges/chat';

const MIN_ZOOM = 80;
const MAX_ZOOM = 120;
const ZOOM_STEP = 10;

export function PledgeReviewWorkspace({
  pledge,
  messages,
}: {
  pledge: EditablePledge;
  messages: PledgeChatMessage[];
}) {
  const router = useRouter();
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [zoom, setZoom] = useState(100);
  const organization = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]
    : pledge.organizations;

  async function applyPatch(patch: PledgeChatPatch) {
    const response = await fetch(`/api/pledges/${pledge.id}`, {
      body: JSON.stringify({
        ...patch,
        organizationSlug: organization?.slug ?? 'haebom',
        version: pledge.version ?? 1,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    });
    if (!response.ok) throw new Error('patch_failed');
    router.refresh();
    window.location.reload();
  }

  return (
    <div
      className={cn(
        'mt-8 grid items-start gap-6',
        !chatCollapsed && 'xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]',
      )}
    >
      <section className="min-w-0" aria-labelledby="pledge-document-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border border-line bg-panel px-4 py-3">
          <div>
            <h2 className="text-sm font-bold" id="pledge-document-title">
              기부 약정서 확인
            </h2>
            <p className="mt-1 text-xs text-copy-muted">
              내용을 직접 수정하거나 AI와 대화해 변경할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              aria-label="약정서 확대 및 축소"
              className="flex items-center border border-line bg-panel"
              role="group"
            >
              <Button
                aria-label="약정서 축소"
                className="border-0 border-r border-line"
                disabled={zoom <= MIN_ZOOM}
                onClick={() =>
                  setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))
                }
                size="small"
                variant="tertiary"
              >
                −
              </Button>
              <span
                aria-live="polite"
                className="min-w-14 text-center text-xs font-medium text-copy-secondary"
              >
                {zoom}%
              </span>
              <Button
                aria-label="약정서 확대"
                className="border-0 border-l border-line"
                disabled={zoom >= MAX_ZOOM}
                onClick={() =>
                  setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))
                }
                size="small"
                variant="tertiary"
              >
                +
              </Button>
            </div>
            {chatCollapsed ? (
              <Button
                aria-expanded="false"
                onClick={() => setChatCollapsed(false)}
                size="small"
                variant="secondary"
              >
                AI 대화 펼치기
              </Button>
            ) : null}
          </div>
        </div>
        <div className="overflow-auto bg-panel-muted">
          <div className="origin-top-left" style={{ zoom: `${zoom}%` }}>
            <PledgeDocumentForm pledge={pledge} />
          </div>
        </div>
      </section>
      {!chatCollapsed ? (
        <div className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]">
          <PledgeChatPanel
            initialMessages={messages}
            onApplyPatch={applyPatch}
            onCollapse={() => setChatCollapsed(true)}
            pledgeId={pledge.id}
          />
        </div>
      ) : null}
    </div>
  );
}
