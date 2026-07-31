'use client';

import { CheckIcon, LockIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import {
  defaultPartnerRegistrationValues,
  getPartnerRegistrationSnapshot,
  parsePartnerRegistrationSnapshot,
} from '@/lib/partner-registration-state';

const inputClassName =
  'h-10 w-full rounded-[var(--radius-sm)] border border-line bg-panel px-3 text-sm text-copy placeholder:text-copy-disabled hover:border-copy-disabled';
const textareaClassName =
  'min-h-24 w-full resize-y rounded-[var(--radius-sm)] border border-line bg-panel px-3 py-2.5 text-sm leading-6 text-copy placeholder:text-copy-disabled hover:border-copy-disabled';

export function PledgeTemplateEditor({
  mode = 'registration',
  initialOrganizationName = '해봄재단',
  registrationReturnHref = '/partner/register',
}: {
  mode?: 'registration' | 'settings';
  initialOrganizationName?: string;
  registrationReturnHref?: string;
}) {
  const registrationSnapshot = useSyncExternalStore(
    () => () => {},
    getPartnerRegistrationSnapshot,
    () => '',
  );
  const storedRegistration = {
    ...defaultPartnerRegistrationValues,
    ...parsePartnerRegistrationSnapshot(registrationSnapshot),
  };
  const registeredOrganizationName =
    storedRegistration.organizationName || initialOrganizationName;
  const [templateName, setTemplateName] = useState(
    `${registeredOrganizationName} 기부 약정서`,
  );
  const [organizationName, setOrganizationName] = useState(
    registeredOrganizationName,
  );
  const [donationTypes, setDonationTypes] = useState({
    cash: true,
    goods: true,
    other: false,
  });
  const [allowDesignated, setAllowDesignated] = useState(true);
  const [allowUndesignated, setAllowUndesignated] = useState(true);
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState({
    card: true,
    transfer: true,
    easy: true,
  });
  const [receiptEnabled, setReceiptEnabled] = useState(true);
  const [reportingClause, setReportingClause] = useState(
    '기부처는 집행 계획, 집행 내역과 완료 보고서를 모두기브를 통해 기부자에게 공개하고 변경 시 알림을 제공합니다.',
  );
  const [cancellationClause, setCancellationClause] = useState(
    '정기 기부는 다음 결제일 3일 전까지 중단을 요청할 수 있으며, 이미 집행된 기부금에는 영향을 주지 않습니다.',
  );
  const [balanceClause, setBalanceClause] = useState(
    '지정 목적 달성 후 잔액이 발생하면 기부자에게 알리고 동의를 받은 용도로 이월하거나 반환합니다.',
  );
  const [customClauses, setCustomClauses] = useState([
    '아동의 개인정보가 포함된 집행 자료는 비식별 처리 후 공개합니다.',
  ]);

  const toggleDonationType = (key: keyof typeof donationTypes) => {
    setDonationTypes((current) => ({ ...current, [key]: !current[key] }));
  };

  const togglePaymentMethod = (key: keyof typeof paymentMethods) => {
    setPaymentMethods((current) => ({ ...current, [key]: !current[key] }));
  };
  const hasDonationType = Object.values(donationTypes).some(Boolean);

  return (
    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
      <div className="grid content-start gap-8">
        <InlineNotice title="표준 약정서 구성 근거">
          후원(기부) 약정서식.pdf 1–2페이지의 기부 정보, 영수증 신청, 개인정보
          동의와 서명 항목을 기준으로 구성했습니다. 3페이지 현물 기부용 장부가액
          확인서는 포함하지 않습니다.
        </InlineNotice>

        <fieldset className="grid gap-5 border-t border-line pt-6">
          <legend className="pr-4 text-lg font-bold">템플릿 기본 정보</legend>
          <label className="grid gap-1.5 text-sm font-medium">
            템플릿 이름
            <input
              className={inputClassName}
              onChange={(event) => setTemplateName(event.target.value)}
              value={templateName}
            />
            <span className="text-xs font-normal text-copy-muted">
              기부자가 아닌 기부처 관리자에게만 표시됩니다.
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            약정서에 표시할 기부처명
            <input
              className={inputClassName}
              onChange={(event) => setOrganizationName(event.target.value)}
              value={organizationName}
            />
          </label>
        </fieldset>

        <fieldset className="grid gap-5 border-t border-line pt-6">
          <legend className="pr-4 text-lg font-bold">기부 조건</legend>
          <section>
            <h3 className="text-sm font-medium">표준 입력 항목</h3>
            <ul className="mt-3 grid gap-2 text-sm text-copy-secondary sm:grid-cols-2">
              {[
                '기부자·단체명과 연락처',
                '기부 종류와 금액',
                '기부 예정일과 약정 기간',
                '지정 여부와 기부 조건',
                '납부 방식',
                '기부금 영수증 신청',
              ].map((item) => (
                <li className="flex items-center gap-2" key={item}>
                  <CheckIcon
                    aria-hidden="true"
                    className="size-4 text-success"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <div>
            <p className="text-sm font-medium">허용할 기부 종류</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ['cash', '현금'],
                ['goods', '현물'],
                ['other', '기타'],
              ].map(([key, label]) => (
                <label
                  className="flex min-h-11 items-center gap-3 border-y border-line px-1 text-sm"
                  key={key}
                >
                  <input
                    checked={donationTypes[key as keyof typeof donationTypes]}
                    className="size-5 accent-accent"
                    onChange={() =>
                      toggleDonationType(key as keyof typeof donationTypes)
                    }
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-copy-muted">
              현물 기부를 허용해도 장부가액 확인서는 이 템플릿에 포함되지
              않습니다.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">허용할 지정 방식</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-11 items-center gap-3 border-y border-line px-1 text-sm">
                <input
                  checked={allowDesignated}
                  className="size-5 accent-accent"
                  onChange={(event) => setAllowDesignated(event.target.checked)}
                  type="checkbox"
                />
                지정 기부
              </label>
              <label className="flex min-h-11 items-center gap-3 border-y border-line px-1 text-sm">
                <input
                  checked={allowUndesignated}
                  className="size-5 accent-accent"
                  onChange={(event) =>
                    setAllowUndesignated(event.target.checked)
                  }
                  type="checkbox"
                />
                비지정 기부
              </label>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">허용할 납부 방식</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ['card', '신용·체크카드'],
                ['transfer', '계좌이체'],
                ['easy', '간편결제'],
              ].map(([key, label]) => (
                <label
                  className="flex min-h-11 items-center gap-3 border-y border-line px-1 text-sm"
                  key={key}
                >
                  <input
                    checked={paymentMethods[key as keyof typeof paymentMethods]}
                    className="size-5 accent-accent"
                    onChange={() =>
                      togglePaymentMethod(key as keyof typeof paymentMethods)
                    }
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3 border-y border-line px-1 text-sm">
            <input
              checked={allowAnonymous}
              className="size-5 accent-accent"
              onChange={(event) => setAllowAnonymous(event.target.checked)}
              type="checkbox"
            />
            기부자 익명 공개 요청 허용
          </label>
          <label className="flex min-h-11 items-center gap-3 border-y border-line px-1 text-sm">
            <input
              checked={receiptEnabled}
              className="size-5 accent-accent"
              onChange={(event) => setReceiptEnabled(event.target.checked)}
              type="checkbox"
            />
            기부금 영수증 신청 항목 제공
          </label>
        </fieldset>

        <fieldset className="grid gap-5 border-t border-line pt-6">
          <legend className="pr-4 text-lg font-bold">기부처 맞춤 조항</legend>
          <label className="grid gap-1.5 text-sm font-medium">
            집행 공개와 보고
            <textarea
              className={textareaClassName}
              onChange={(event) => setReportingClause(event.target.value)}
              value={reportingClause}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            정기 기부 중단
            <textarea
              className={textareaClassName}
              onChange={(event) => setCancellationClause(event.target.value)}
              value={cancellationClause}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            집행 후 잔액 처리
            <textarea
              className={textareaClassName}
              onChange={(event) => setBalanceClause(event.target.value)}
              value={balanceClause}
            />
          </label>
          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">추가 조항</p>
              <button
                className={buttonClassName({
                  variant: 'secondary',
                  size: 'small',
                })}
                onClick={() => setCustomClauses((current) => [...current, ''])}
                type="button"
              >
                <PlusIcon aria-hidden="true" className="size-4" /> 조항 추가
              </button>
            </div>
            <div className="mt-3 grid gap-3">
              {customClauses.map((clause, index) => (
                <div className="grid grid-cols-[1fr_40px] gap-2" key={index}>
                  <textarea
                    aria-label={`추가 조항 ${index + 1}`}
                    className={textareaClassName}
                    onChange={(event) =>
                      setCustomClauses((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder="기부처 고유 조건을 입력하세요."
                    value={clause}
                  />
                  <button
                    aria-label={`추가 조항 ${index + 1} 삭제`}
                    className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-copy-muted hover:bg-panel-muted hover:text-danger"
                    onClick={() =>
                      setCustomClauses((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    type="button"
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </fieldset>

        <section className="border-t border-line pt-6">
          <div className="flex items-center gap-2">
            <LockIcon aria-hidden="true" className="size-4 text-copy-muted" />
            <h2 className="text-lg font-bold">필수 개인정보 조항</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-copy-muted">
            개인정보 수집·이용, 고유식별정보 처리, 국세청 제3자 제공 동의는 관련
            법령과 실제 운영 정책 검토가 필요한 영역이므로 기부처가 임의로
            삭제할 수 없습니다. 영수증을 신청한 기부자에게만 필요한 식별정보를
            별도 단계에서 요청합니다.
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <Link
            className={buttonClassName({ variant: 'secondary' })}
            href={
              mode === 'registration'
                ? registrationReturnHref
                : '/partner/settings/pledge-template'
            }
          >
            {mode === 'registration' ? '기부처 정보로 돌아가기' : '변경 취소'}
          </Link>
          {hasDonationType ? (
            <Link
              className={buttonClassName({ size: 'large' })}
              href={
                mode === 'registration'
                  ? '/partner'
                  : '/partner/settings/pledge-template'
              }
            >
              {mode === 'registration'
                ? '템플릿 저장·등록 완료'
                : '변경사항 저장'}
            </Link>
          ) : (
            <div className="grid justify-items-end gap-2">
              <button
                className={buttonClassName({ size: 'large' })}
                disabled
                type="button"
              >
                {mode === 'registration'
                  ? '템플릿 저장·등록 완료'
                  : '변경사항 저장'}
              </button>
              <p className="text-xs text-danger" role="alert">
                기부 종류를 하나 이상 선택해야 저장할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="border border-line bg-panel p-5 shadow-[var(--shadow-overlay)]">
          <div className="border-b border-line pb-4">
            <p className="text-xs text-copy-muted">실시간 미리보기</p>
            <h2 className="mt-1 text-lg font-bold">{templateName}</h2>
          </div>
          <article className="mt-5 text-sm leading-6">
            <h3 className="text-center text-xl font-bold">기부 약정서</h3>
            <p className="mt-5">
              기부자는 아래 조건에 따라 {organizationName}에 기부할 것을
              약정합니다.
            </p>
            <dl className="mt-5 divide-y divide-line border-y border-line">
              <div className="grid grid-cols-[100px_1fr] py-3">
                <dt className="text-copy-muted">기부자</dt>
                <dd>[상담 정보에서 자동 입력]</dd>
              </div>
              <div className="grid grid-cols-[100px_1fr] py-3">
                <dt className="text-copy-muted">기부 종류</dt>
                <dd>
                  {[
                    donationTypes.cash && '현금',
                    donationTypes.goods && '현물',
                    donationTypes.other && '기타',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '선택 필요'}
                </dd>
              </div>
              <div className="grid grid-cols-[100px_1fr] py-3">
                <dt className="text-copy-muted">지정 방식</dt>
                <dd>
                  {[
                    allowDesignated && '지정 기부',
                    allowUndesignated && '비지정 기부',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '선택 필요'}
                </dd>
              </div>
              <div className="grid grid-cols-[100px_1fr] py-3">
                <dt className="text-copy-muted">금액·기간</dt>
                <dd>[기부자 상담 결과에서 자동 입력]</dd>
              </div>
              <div className="grid grid-cols-[100px_1fr] py-3">
                <dt className="text-copy-muted">납부 방식</dt>
                <dd>
                  {[
                    paymentMethods.card && '신용·체크카드',
                    paymentMethods.transfer && '계좌이체',
                    paymentMethods.easy && '간편결제',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '선택 필요'}
                </dd>
              </div>
            </dl>

            {allowAnonymous ? (
              <p className="mt-3 text-xs text-copy-muted">
                기부자는 공개 화면에서 이름을 익명으로 표시하도록 요청할 수
                있습니다.
              </p>
            ) : null}

            <section className="mt-5">
              <h4 className="font-bold">기부 조건</h4>
              <ol className="mt-2 grid gap-2 text-copy-secondary">
                <li>1. {reportingClause}</li>
                <li>2. {cancellationClause}</li>
                <li>3. {balanceClause}</li>
                {customClauses
                  .filter((clause) => clause.trim())
                  .map((clause, index) => (
                    <li key={index}>
                      {index + 4}. {clause}
                    </li>
                  ))}
              </ol>
            </section>

            {receiptEnabled ? (
              <section className="mt-5 border-t border-line pt-4">
                <h4 className="font-bold">기부금 영수증</h4>
                <p className="mt-1 text-copy-secondary">
                  기부자는 영수증 발급을 신청할 수 있습니다. 발급에 필요한
                  식별정보는 신청자에게만 별도로 수집합니다.
                </p>
              </section>
            ) : null}

            <section className="mt-5 border-t border-line pt-4">
              <h4 className="font-bold">개인정보 동의</h4>
              <ul className="mt-2 grid gap-2 text-copy-secondary">
                <li className="flex gap-2">
                  <CheckIcon
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-success"
                  />
                  기부 신청과 내역 제공을 위한 개인정보 수집·이용 동의
                </li>
                {receiptEnabled ? (
                  <li className="flex gap-2">
                    <CheckIcon
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-success"
                    />
                    영수증 발급을 위한 고유식별정보 처리 및 국세청 제공 동의
                  </li>
                ) : null}
              </ul>
            </section>

            <p className="mt-8 text-center text-copy-muted">
              기부자 서명 · {organizationName} 서명
            </p>
          </article>
        </div>
      </aside>
    </div>
  );
}
