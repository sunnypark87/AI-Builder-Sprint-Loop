'use client';

import { Building2Icon, CreditCardIcon, SmartphoneIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import type { Organization } from '@/lib/mock-data/organizations';

const methods = [
  { id: 'card', label: '신용·체크카드', icon: CreditCardIcon },
  { id: 'transfer', label: '계좌이체', icon: Building2Icon },
  { id: 'easy', label: '간편결제', icon: SmartphoneIcon },
];

export function PaymentForm({ organization }: { organization: Organization }) {
  const [method, setMethod] = useState('card');

  return (
    <main className="mx-auto max-w-[980px] px-4 py-12 md:px-6">
      <h1 className="text-3xl font-bold">기부 결제</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="text-xl font-bold">결제수단 선택</h2>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {methods.map(({ id, label, icon: Icon }) => (
              <button
                aria-pressed={method === id}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 px-2 text-left text-sm font-medium',
                  method === id
                    ? 'bg-accent-soft text-accent-strong'
                    : 'hover:bg-panel-muted',
                )}
                key={id}
                onClick={() => setMethod(id)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border',
                    method === id
                      ? 'border-accent-strong'
                      : 'border-copy-disabled',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      method === id && 'bg-accent-strong',
                    )}
                  />
                </span>
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5 border-l-2 border-line pl-4">
            <p className="text-sm font-medium">
              {methods.find((item) => item.id === method)?.label} 결제 안내
            </p>
            <p className="mt-2 text-sm leading-6 text-copy-muted">
              카드번호, 계좌번호, 간편결제 계정 입력 없이 결제를 진행합니다.
            </p>
          </div>
        </section>
        <aside>
          <Card className="p-5">
            <h2 className="text-lg font-bold">결제 요약</h2>
            <dl className="mt-5 grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-copy-muted">기부처</dt>
                <dd className="font-medium">{organization.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-copy-muted">기부 목적</dt>
                <dd className="text-right font-medium">
                  {organization.donationPurpose}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-copy-muted">기부 유형</dt>
                <dd className="font-medium">월 정기 기부</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-copy-muted">이번 결제</dt>
                <dd className="font-medium">2026. 08.</dd>
              </div>
            </dl>
            <div className="mt-5 flex items-end justify-between border-t border-line pt-5">
              <span className="font-medium">총 결제금액</span>
              <strong className="text-2xl">50,000원</strong>
            </div>
            <Link
              className={buttonClassName({
                className: 'mt-6 w-full',
                size: 'large',
              })}
              href={`/donations/demo/payment/result?organizationId=${organization.id}`}
            >
              결제하기
            </Link>
          </Card>
        </aside>
      </div>
    </main>
  );
}
