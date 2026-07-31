import Link from 'next/link';
import { Building2Icon, HeartHandshakeIcon } from 'lucide-react';

import { buttonClassName } from '@/components/ui/button';

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-[760px] px-4 py-14 md:px-6">
      <p className="text-sm text-copy-muted">데모 계정</p>
      <h1 className="mt-2 text-3xl font-bold">어떤 화면을 둘러볼까요?</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-copy-muted">
        해커톤 목업에서는 개인정보 입력이나 실제 인증 없이 역할별 화면으로
        이동합니다.
      </p>
      <div className="mt-8 divide-y divide-line border-y border-line">
        <section className="grid gap-5 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <HeartHandshakeIcon
              className="size-6 text-accent-strong"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-lg font-bold">기부자 화면</h2>
            <p className="mt-2 text-sm text-copy-muted">
              기부처 탐색, 약정과 집행 현황을 확인합니다.
            </p>
          </div>
          <Link className={buttonClassName()} href="/my-donations">
            기부자로 둘러보기
          </Link>
        </section>
        <section className="grid gap-5 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <Building2Icon
              className="size-6 text-accent-strong"
              aria-hidden="true"
            />
            <h2 className="mt-3 text-lg font-bold">기부처 관리 화면</h2>
            <p className="mt-2 text-sm text-copy-muted">
              약정, 집행 계획, 증빙과 보고서를 관리합니다.
            </p>
          </div>
          <Link
            className={buttonClassName({ variant: 'secondary' })}
            href="/partner"
          >
            기부처로 둘러보기
          </Link>
        </section>
      </div>
    </main>
  );
}
