'use client';

import { useState } from 'react';

import {
  createMockAssistantReply,
  type PledgeChatMessage,
  type PledgeChatPatch,
} from '@/lib/pledges/chat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const suggestions = [
  '매월 5만원씩 기부하고 싶어요',
  '아동 교육에 사용해 주세요',
  '집행 내역을 보고받고 싶어요',
];

export function PledgeChatPanel({
  initialMessages,
  pledgeId,
  onApplyPatch,
  onMessagesChange,
  onCollapse,
}: {
  initialMessages: PledgeChatMessage[];
  pledgeId?: string;
  onApplyPatch?: (patch: PledgeChatPatch) => Promise<void> | void;
  onMessagesChange?: (messages: PledgeChatMessage[]) => void;
  onCollapse?: () => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateMessages(next: PledgeChatMessage[]) {
    setMessages(next);
    onMessagesChange?.(next);
  }

  async function sendMessage(value = input) {
    const message = value.trim();
    if (!message || sending) return;
    setSending(true);
    setInput('');

    if (pledgeId) {
      const response = await fetch(`/api/pledges/${pledgeId}/chat`, {
        body: JSON.stringify({ message }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (response.ok) {
        const result = (await response.json()) as {
          messages: PledgeChatMessage[];
        };
        updateMessages([...messages, ...result.messages]);
      } else {
        setInput(message);
      }
    } else {
      const reply = createMockAssistantReply(message);
      updateMessages([
        ...messages,
        { content: message, role: 'user' },
        {
          content: reply.content,
          proposedPatch: reply.proposedPatch,
          role: 'assistant',
        },
      ]);
    }
    setSending(false);
  }

  async function applyPatch(message: PledgeChatMessage) {
    if (!message.proposedPatch || !onApplyPatch || applying) return;
    setApplying(message.content);
    setError(null);
    try {
      await onApplyPatch(message.proposedPatch);
      setMessages((current) =>
        current.map((item) =>
          item === message ? { ...item, proposedPatch: undefined } : item,
        ),
      );
    } catch {
      setError('변경 내용을 약정서에 반영하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setApplying(null);
    }
  }

  return (
    <section className="flex min-h-[540px] max-h-[760px] flex-col border border-line bg-panel xl:max-h-[calc(100vh-3rem)]">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-sm font-bold">AI와 약정 내용 확인하기</p>
          <p className="mt-1 text-xs leading-5 text-copy-muted">
            이번 화면의 AI는 예시 대화입니다. 약정서에 반영하기 전 변경 내용을
            확인해 주세요.
          </p>
        </div>
        {onCollapse ? (
          <Button
            aria-expanded="true"
            aria-label="AI 대화창 접기"
            className="px-2"
            onClick={onCollapse}
            size="small"
            variant="tertiary"
          >
            접기
          </Button>
        ) : null}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.map((message, index) => (
          <div
            className={cn('max-w-[92%]', message.role === 'user' && 'ml-auto')}
            key={message.id ?? `${message.role}-${index}`}
          >
            <p className="text-xs font-bold text-copy-muted">
              {message.role === 'assistant' ? '모두기브 AI' : '나'}
            </p>
            <div
              className={cn(
                'mt-1 rounded-[var(--radius-md)] px-3 py-2 text-sm leading-6',
                message.role === 'assistant'
                  ? 'bg-panel-muted'
                  : 'bg-accent-soft',
              )}
            >
              {message.content}
            </div>
            {message.proposedPatch && onApplyPatch ? (
              <div className="mt-2 border border-accent bg-accent-soft p-3 text-xs">
                <p className="font-bold">약정서 변경 제안</p>
                <dl className="mt-2 grid gap-1 text-copy-secondary">
                  {Object.entries(message.proposedPatch).map(
                    ([field, value]) => (
                      <div className="flex justify-between gap-3" key={field}>
                        <dt>{fieldLabel(field)}</dt>
                        <dd className="font-bold">
                          {formatPatchValue(field, value)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
                <Button
                  className="mt-3 w-full"
                  loading={applying === message.content}
                  onClick={() => void applyPatch(message)}
                  size="small"
                  variant="secondary"
                >
                  약정서에 반영
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="border-t border-line px-5 py-4">
        {error ? <p className="mb-2 text-xs text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              className="min-h-8 border-b border-line px-1 text-left text-xs text-copy-muted hover:border-copy-disabled hover:text-copy focus-visible:outline-2 focus-visible:outline-offset-2"
              key={suggestion}
              onClick={() => void sendMessage(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <textarea
            aria-label="AI에게 메시지 보내기"
            className="min-h-11 flex-1 resize-none rounded-[var(--radius-sm)] border border-line bg-panel px-3 py-2 text-sm"
            onChange={(event) => setInput(event.target.value)}
            placeholder="약정 내용에 대해 말해 주세요"
            value={input}
          />
          <Button
            disabled={!input.trim()}
            loading={sending}
            type="submit"
            variant="secondary"
          >
            보내기
          </Button>
        </form>
      </div>
    </section>
  );
}

function fieldLabel(field: string) {
  return (
    {
      amount: '기부 금액',
      donationCondition: '집행·공개 조건',
      donationType: '기부 유형',
      purpose: '기부 목적',
    }[field] ?? field
  );
}

function formatPatchValue(field: string, value: unknown) {
  if (field === 'amount' && typeof value === 'number')
    return `${value.toLocaleString('ko-KR')}원`;
  return String(value);
}
