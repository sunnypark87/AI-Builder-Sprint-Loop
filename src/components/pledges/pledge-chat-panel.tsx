'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  type PledgeChatMessage,
  type PledgeChatPatch,
} from '@/lib/pledges/chat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export function PledgeChatPanel({
  initialMessages,
  messages: controlledMessages,
  pledgeId,
  onEnsurePledge,
  onMessagesChange,
  onAppliedPatch,
  onCollapse,
  renderContextualHelp,
}: {
  initialMessages: PledgeChatMessage[];
  messages?: PledgeChatMessage[];
  pledgeId?: string;
  onEnsurePledge?: () => Promise<string | null>;
  onMessagesChange?: (messages: PledgeChatMessage[]) => void;
  onAppliedPatch?: (
    patch: PledgeChatPatch,
    pledgeVersion: number | null,
  ) => void;
  onCollapse?: () => void;
  renderContextualHelp?: (select: (value: string) => void) => ReactNode;
}) {
  const [internalMessages, setInternalMessages] = useState(initialMessages);
  const messages = controlledMessages ?? internalMessages;
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ message: string; key: string } | null>(
    null,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const latestQuestion = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')?.nextQuestionField;
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const suggestions = latestAssistant?.suggestedReplies?.length
    ? latestAssistant.suggestedReplies
    : questionSuggestions(latestQuestion).map((message) => ({
        id: message,
        label: message,
        message,
      }));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  function updateMessages(next: PledgeChatMessage[]) {
    if (!controlledMessages) setInternalMessages(next);
    onMessagesChange?.(next);
  }

  async function sendMessage(value = input) {
    const message = value.trim();
    if (!message || sending) return;
    setSending(true);
    setInput('');
    setError(null);

    try {
      const activePledgeId = pledgeId ?? (await onEnsurePledge?.());
      if (activePledgeId) {
        const idempotencyKey =
          retry?.message === message ? retry.key : crypto.randomUUID();
        const response = await fetch(`/api/pledges/${activePledgeId}/chat`, {
          body: JSON.stringify({ message }),
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          method: 'POST',
        });
        if (!response.ok) {
          const failure = (await response.json().catch(() => null)) as {
            error?: { retryable?: boolean };
          } | null;
          if (failure?.error?.retryable)
            setRetry({ message, key: idempotencyKey });
          throw new Error('consultation_failed');
        }
        const result = (await response.json()) as {
          userMessage: PledgeChatMessage;
          assistantMessage: PledgeChatMessage | null;
          appliedPatch?: Record<string, unknown>;
          missingFields?: string[];
          nextQuestionField?: string | null;
          pledgeVersion?: number | null;
        };
        const assistant = result.assistantMessage
          ? {
              ...result.assistantMessage,
              proposedPatch: toPledgeChatPatch(result.appliedPatch),
              missingFields: result.missingFields,
              nextQuestionField: result.nextQuestionField,
              suggestedReplies: result.assistantMessage.suggestedReplies,
            }
          : null;
        updateMessages([
          ...messages,
          result.userMessage,
          ...(assistant ? [assistant] : []),
        ]);
        if (assistant?.proposedPatch)
          onAppliedPatch?.(
            assistant.proposedPatch,
            result.pledgeVersion ?? null,
          );
        setRetry(null);
      } else {
        throw new Error('pledge_create_failed');
      }
    } catch {
      setInput(message);
      setError('상담 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex min-h-[540px] max-h-[760px] flex-col border border-line bg-panel xl:max-h-[calc(100vh-3rem)]">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-sm font-bold">약정 작성 대화</p>
          <p className="mt-1 text-xs leading-5 text-copy-muted">
            대화에서 확인된 내용은 약정서 초안에 자동으로 작성됩니다. 최종
            내용은 다음 검토 화면에서 수정할 수 있어요.
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
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
      >
        {messages.map((message, index) => (
          <div
            className={cn(
              'flex max-w-[94%] items-start gap-2',
              message.role === 'user' && 'ml-auto flex-row-reverse',
            )}
            key={message.id ?? `${message.role}-${index}`}
          >
            <div
              aria-hidden="true"
              className={cn(
                'mt-5 flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-sm font-bold',
                message.role === 'assistant'
                  ? 'bg-accent text-copy'
                  : 'bg-panel-muted text-copy-muted',
              )}
            >
              {message.role === 'assistant' ? 'M' : '나'}
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  'text-xs font-bold text-copy-muted',
                  message.role === 'user' && 'text-right',
                )}
              >
                {message.role === 'assistant' ? '모두기브 AI' : '나'}
              </p>
              <div
                className={cn(
                  'mt-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm leading-6',
                  message.role === 'assistant'
                    ? 'border-line bg-panel-muted'
                    : 'border-accent bg-accent-soft',
                )}
              >
                {message.content}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-line px-5 py-4">
        {error ? (
          <p
            aria-live="assertive"
            className="mb-2 text-xs text-danger"
            role="alert"
          >
            {error}
            {retry ? ' 같은 요청으로 다시 시도할 수 있습니다.' : ''}
          </p>
        ) : null}
        {renderContextualHelp ? renderContextualHelp(setInput) : null}
        <div className="mt-3 flex flex-wrap gap-2" aria-label="추천 답변">
          {suggestions.map((suggestion) => (
            <button
              className="min-h-9 rounded-[var(--radius-sm)] border border-line bg-panel px-3 text-left text-xs text-copy-secondary hover:border-accent hover:text-copy focus-visible:outline-2 focus-visible:outline-offset-2"
              key={suggestion.id}
              onClick={() => setInput(suggestion.message)}
              type="button"
            >
              {suggestion.label}
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

function toPledgeChatPatch(value: Record<string, unknown> | undefined) {
  if (!value) return undefined;
  const allowed = [
    'amount',
    'donationDesignation',
    'donationCondition',
    'paymentSchedule',
    'paymentScheduleOther',
    'paymentMethod',
    'paymentMethodOther',
  ] as const;
  const patch: PledgeChatPatch = {};
  for (const field of allowed) {
    const item = value[field];
    if (item !== undefined) patch[field] = item as never;
  }
  return Object.keys(patch).length ? patch : undefined;
}

function questionSuggestions(field?: string | null) {
  switch (field) {
    case 'amount':
      return ['5만원을 기부할게요', '10만원을 기부할게요'];
    case 'donationDesignation':
      return ['지정 기부로 할게요', '비지정 기부로 할게요'];
    case 'donationCondition':
      return [
        '재단의 주요 활동을 추천해 주세요',
        '기부 조건을 직접 작성할게요',
      ];
    case 'paymentSchedule':
      return ['일시 납부할게요', '분할 납부하고 싶어요'];
    case 'paymentScheduleOther':
      return ['매월 분할 납부할게요', '분기별로 납부할게요'];
    case 'paymentMethod':
      return [
        '온라인으로 납부할게요',
        '직접 전달할게요',
        '기타 수단을 사용할게요',
      ];
    case 'paymentMethodOther':
      return ['계좌이체로 납부할게요'];
    default:
      return ['5만원을 기부할게요', '기부 유형부터 정할게요'];
  }
}
