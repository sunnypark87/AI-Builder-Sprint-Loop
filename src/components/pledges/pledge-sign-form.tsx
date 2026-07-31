'use client';

import { ShieldCheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function PledgeSignForm({ organizationId }: { organizationId: string }) {
  const [consented, setConsented] = useState(false);

  return (
    <>
      <Card className="mt-8 p-6">
        <ShieldCheckIcon className="size-8 text-accent-strong" />
        <h2 className="mt-4 text-xl font-bold">서명 전 확인</h2>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-copy-secondary">
          <li>약정 금액과 기간, 집행 공개 조건을 확인했습니다.</li>
          <li>
            이 화면은 해커톤용 목업이며 법적 전자서명을 생성하지 않습니다.
          </li>
          <li>실제 주민등록번호, 인증서 또는 결제정보를 입력하지 않습니다.</li>
        </ul>
        <label className="mt-6 flex gap-3 border-t border-line pt-5 text-sm font-medium">
          <input
            checked={consented}
            className="mt-1 size-5 accent-accent"
            onChange={(event) => setConsented(event.target.checked)}
            type="checkbox"
          />
          예시 약정서 내용을 확인하고 목업 서명 진행에 동의합니다.
        </label>
      </Card>
      <div className="mt-8 flex justify-between gap-3">
        <Link
          className={buttonClassName({ variant: 'secondary' })}
          href={`/pledges/demo/review?organizationId=${organizationId}`}
        >
          약정서 다시 보기
        </Link>
        {consented ? (
          <Link
            className={buttonClassName()}
            href={`/pledges/demo/waiting?organizationId=${organizationId}`}
          >
            예시 서명 완료
          </Link>
        ) : (
          <button className={buttonClassName()} disabled type="button">
            예시 서명 완료
          </button>
        )}
      </div>
    </>
  );
}
