'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const methods = [
  ['card', '신용·체크카드'],
  ['transfer', '계좌이체'],
  ['easy', '간편결제'],
] as const;

export function PledgePaymentForm({
  pledge,
}: {
  pledge: {
    id: string;
    amount: number | string;
    purpose: string;
    organizationName: string;
  };
}) {
  const router = useRouter();
  const [method, setMethod] = useState<(typeof methods)[number][0]>('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/pledges/${pledge.id}/demo-payment`, {
      body: JSON.stringify({ method, status: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const result = (await response.json().catch(() => null)) as {
      payment?: { status: string };
      code?: string;
    } | null;
    if (!response.ok || !result?.payment) {
      setError(
        result?.code === 'payment_unavailable_before_signature'
          ? '양측 서명이 완료된 뒤 결제할 수 있습니다.'
          : '결제를 처리하지 못했습니다.',
      );
      setLoading(false);
      return;
    }
    router.push(`/donations/${pledge.id}/payment/result`);
  }

  return (
    <main className="mx-auto max-w-[980px] px-4 py-12 md:px-6">
      <h1 className="text-3xl font-bold">기부 결제</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="text-xl font-bold">결제수단 선택</h2>
          <div className="mt-4 grid gap-2">
            {methods.map(([value, label]) => (
              <button
                aria-pressed={method === value}
                className="border border-line p-4 text-left text-sm"
                key={value}
                onClick={() => setMethod(value)}
                type="button"
              >
                {method === value ? '● ' : '○ '}
                {label}
              </button>
            ))}
          </div>
        </section>
        <Card className="p-5">
          <h2 className="text-lg font-bold">결제 요약</h2>
          <p className="mt-4 text-sm text-copy-muted">
            {pledge.organizationName}
          </p>
          <p className="mt-2 text-sm">{pledge.purpose}</p>
          <strong className="mt-6 block text-2xl">
            {Number(pledge.amount).toLocaleString('ko-KR')}원
          </strong>
          <Button
            className="mt-6 w-full"
            loading={loading}
            onClick={() => void submit()}
            size="large"
          >
            결제하기
          </Button>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </Card>
      </div>
    </main>
  );
}
