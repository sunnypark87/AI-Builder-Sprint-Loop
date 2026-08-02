'use client';

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { Button, buttonClassName } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  formatIdentityNumberInput,
  formatMobilePhoneInput,
  isValidEmailInput,
  isValidIdentityNumberInput,
  isValidMobilePhoneInput,
} from '@/lib/pledges/contact-format';

export type EditablePledge = {
  id: string;
  amount: number | string | null;
  donor_address: string | null;
  donor_contact: string | null;
  donor_email: string | null;
  donor_identity_number_collected_at: string | null;
  donor_identity_number_last4: string | null;
  donor_name: string | null;
  donation_condition: string | null;
  donation_designation: 'designated' | 'undesignated' | null;
  donation_kind: 'cash' | 'other' | null;
  donation_kind_other: string | null;
  donation_type: string | null;
  identity_info_consent: boolean | null;
  payment_method: 'online' | 'direct' | 'other' | null;
  payment_method_other: string | null;
  payment_schedule: 'lump_sum' | 'other' | null;
  payment_schedule_other: string | null;
  personal_info_consent: boolean | null;
  pledge_date: string | null;
  purpose: string | null;
  receipt_requested: boolean;
  receipt_recipient_address: string | null;
  receipt_recipient_name: string | null;
  third_party_info_consent: boolean | null;
  version?: number;
  organizations?:
    | { name?: string; slug?: string }
    | { name?: string; slug?: string }[]
    | null;
};

export function PledgeDocumentForm({ pledge }: { pledge: EditablePledge }) {
  const router = useRouter();
  const organization = Array.isArray(pledge.organizations)
    ? pledge.organizations[0]
    : pledge.organizations;
  const organizationSlug = organization?.slug ?? 'haebom';
  const [form, setForm] = useState({
    address: pledge.donor_address ?? '',
    amount: pledge.amount == null ? '' : String(pledge.amount),
    contact: pledge.donor_contact ?? '',
    donorEmail: pledge.donor_email ?? '',
    identityNumber: '',
    donorName: pledge.donor_name ?? '',
    donationCondition: pledge.donation_condition ?? '',
    donationDesignation: pledge.donation_designation ?? '',
    donationKind: pledge.donation_kind ?? '',
    donationKindOther: pledge.donation_kind_other ?? '',
    donationType: pledge.donation_type ?? '',
    pledgeDate: pledge.pledge_date ?? '',
    paymentMethod: pledge.payment_method ?? '',
    paymentMethodOther: pledge.payment_method_other ?? '',
    paymentSchedule: pledge.payment_schedule ?? '',
    paymentScheduleOther: pledge.payment_schedule_other ?? '',
    personalInfoConsent: pledge.personal_info_consent,
    purpose: pledge.purpose ?? '',
    receiptRequested: pledge.receipt_requested,
    thirdPartyInfoConsent: pledge.third_party_info_consent,
    identityInfoConsent: pledge.identity_info_consent,
  });
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveAndContinue() {
    setError(null);
    const missing = [
      ['donorName', '기부자명'],
      ['address', '주소'],
      ['contact', '연락처'],
      ['amount', '기부 금액'],
      ['donationType', '기부 유형'],
      ['purpose', '기부 목적'],
      ['pledgeDate', '약정일'],
    ]
      .filter(
        ([field]) => !String(form[field as keyof typeof form] ?? '').trim(),
      )
      .map(([, label]) => label);
    if (missing.length) {
      setError(`서명 전에 다음 내용을 입력해 주세요: ${missing.join(', ')}`);
      return;
    }
    if (!form.identityNumber.trim() && !pledge.donor_identity_number_last4) {
      setError('서명 전에 주민등록번호를 입력해 주세요.');
      return;
    }
    if (
      form.identityNumber.trim() &&
      !isValidIdentityNumberInput(form.identityNumber)
    ) {
      setError('주민등록번호 13자리를 확인해 주세요.');
      return;
    }
    if (!isValidMobilePhoneInput(form.contact)) {
      setError('휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요.');
      return;
    }
    if (form.donorEmail.trim() && !isValidEmailInput(form.donorEmail)) {
      setError('이메일 형식을 확인해 주세요.');
      return;
    }
    const selectionMissing = [
      [!form.donationKind, '기부 종류'],
      [
        form.donationKind === 'other' && !form.donationKindOther,
        '기타 기부 종류',
      ],
      [!form.donationDesignation, '지정 여부'],
      [!form.paymentSchedule, '납부 주기'],
      [!form.paymentMethod, '납부 방법'],
      [
        form.paymentMethod === 'other' && !form.paymentMethodOther,
        '기타 납부 방법',
      ],
      [
        form.paymentSchedule === 'other' && !form.paymentScheduleOther,
        '기타 납부 주기',
      ],
      [form.personalInfoConsent !== true, '개인정보 수집·이용 동의'],
      [form.thirdPartyInfoConsent !== true, '개인정보 제3자 제공 동의'],
      [form.identityInfoConsent === null, '고유식별정보 처리 확인'],
    ]
      .filter(([isMissing]) => isMissing)
      .map(([, label]) => label);
    if (selectionMissing.length) {
      setError(
        `서명 전에 다음 항목을 확인해 주세요: ${selectionMissing.join(', ')}`,
      );
      return;
    }
    const { identityNumber, ...persistedForm } = form;
    const response = await fetch(`/api/pledges/${pledge.id}`, {
      body: JSON.stringify({
        ...persistedForm,
        ...(identityNumber.trim() ? { identityNumber } : {}),
        amount: Number(form.amount),
        organizationSlug,
        version: pledge.version ?? 1,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        code?: string;
        errors?: Array<{ message: string }>;
      } | null;
      if (result?.code === 'pledge_not_editable') {
        router.push(`/pledges/${pledge.id}/sign`);
        return;
      }
      setError(
        result?.errors?.[0]?.message ??
          getPledgeSaveErrorMessage(result?.code) ??
          '약정서를 저장하지 못했습니다.',
      );
      return;
    }

    router.push(`/pledges/${pledge.id}/sign`);
  }

  return (
    <div className="overflow-hidden border border-line bg-panel">
      <div className="grid gap-6 bg-panel-muted p-3 sm:p-5">
        <section className="mx-auto w-full max-w-[820px] border border-copy bg-panel px-4 py-6 text-[11px] leading-4 sm:px-8 sm:py-9 sm:text-xs">
          <p className="text-right font-bold">* 필수 입력</p>
          <h2 className="mt-2 border-2 border-b-0 border-copy bg-panel-muted py-2 text-center text-xl font-bold sm:text-2xl">
            후원(기부) 약정서
          </h2>
          <table className="w-full table-fixed border-collapse border-2 border-copy">
            <tbody>
              <tr>
                <DocumentGroupHeader rowSpan={5}>
                  기부자(처)
                  <br />
                  인적사항
                </DocumentGroupHeader>
                <DocumentLabel required>기부자(처)</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <DocumentInput
                    ariaLabel="기부자명"
                    value={form.donorName}
                    onChange={(value) => update('donorName', value)}
                  />
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel required>주소(소재지)</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <DocumentInput
                    ariaLabel="주소"
                    value={form.address}
                    onChange={(value) => update('address', value)}
                  />
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel required>주민등록번호</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <div className="flex items-center gap-2">
                    <DocumentInput
                      ariaLabel="주민등록번호"
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={14}
                      placeholder={
                        pledge.donor_identity_number_last4
                          ? `저장됨 (끝 4자리 ${pledge.donor_identity_number_last4}) · 다시 입력하면 변경`
                          : '000000-0000000'
                      }
                      type="text"
                      value={form.identityNumber}
                      onChange={(value) =>
                        update(
                          'identityNumber',
                          formatIdentityNumberInput(value),
                        )
                      }
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-copy-muted">
                    개인 기부금 증빙을 위해 암호화하여 저장합니다.
                  </p>
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel required>연락처</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <DocumentInput
                    ariaLabel="연락처"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={13}
                    placeholder="010-0000-0000"
                    type="tel"
                    value={form.contact}
                    onChange={(value) =>
                      update('contact', formatMobilePhoneInput(value))
                    }
                  />
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel>E-mail</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <DocumentInput
                    ariaLabel="이메일"
                    autoComplete="email"
                    placeholder="name@example.com"
                    type="email"
                    value={form.donorEmail}
                    onChange={(value) => update('donorEmail', value)}
                  />
                </DocumentCell>
              </tr>
              <tr>
                <DocumentGroupHeader rowSpan={7}>
                  기부금품
                  <br />
                  세부정보
                </DocumentGroupHeader>
                <DocumentLabel required>기부 종류</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {[
                      ['cash', '현금'],
                      ['other', '기타'],
                    ].map(([value, label]) => (
                      <label
                        className="inline-flex items-center gap-1"
                        key={value}
                      >
                        <input
                          aria-label={label}
                          checked={form.donationKind === value}
                          className="size-3.5 accent-accent"
                          name="donationKind"
                          onChange={() =>
                            setForm((current) => ({
                              ...current,
                              donationKind: value,
                              donationType: label,
                            }))
                          }
                          type="checkbox"
                        />
                        {label}
                      </label>
                    ))}
                    {form.donationKind === 'other' ? (
                      <DocumentInput
                        ariaLabel="기타 기부 종류"
                        placeholder="기부 종류 입력"
                        value={form.donationKindOther}
                        onChange={(value) => update('donationKindOther', value)}
                      />
                    ) : null}
                  </div>
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel required>기부 금액</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <div className="flex items-center gap-2">
                    <DocumentInput
                      ariaLabel="기부 금액"
                      min="1"
                      type="number"
                      value={form.amount}
                      onChange={(value) => update('amount', value)}
                    />
                    <span className="shrink-0">원(₩)</span>
                  </div>
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel required>기부 예정일</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <DocumentInput
                    ariaLabel="약정일"
                    type="date"
                    value={form.pledgeDate}
                    onChange={(value) => update('pledgeDate', value)}
                  />
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel required>기부 유형</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {[
                      ['designated', '지정 기부'],
                      ['undesignated', '비지정 기부'],
                    ].map(([value, label]) => (
                      <label
                        className="inline-flex items-center gap-1"
                        key={value}
                      >
                        <input
                          aria-label={label}
                          checked={form.donationDesignation === value}
                          className="size-3.5 accent-accent"
                          name="donationCategory"
                          onChange={() => update('donationDesignation', value)}
                          type="checkbox"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel required>기부 목적</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <DocumentTextarea
                    ariaLabel="기부 목적"
                    value={form.purpose}
                    onChange={(value) => update('purpose', value)}
                  />
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel>기부 조건</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <DocumentTextarea
                    ariaLabel="기부 조건"
                    value={form.donationCondition}
                    onChange={(value) => update('donationCondition', value)}
                  />
                </DocumentCell>
              </tr>
              <tr>
                <DocumentLabel required>납부 방법</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <div className="grid gap-1">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {[
                        ['lump_sum', '일시 납부'],
                        ['other', '기타 주기'],
                      ].map(([value, label]) => (
                        <label
                          className="inline-flex items-center gap-1"
                          key={value}
                        >
                          <input
                            aria-label={label}
                            checked={form.paymentSchedule === value}
                            className="size-3.5 accent-accent"
                            name="paymentSchedule"
                            onChange={() => update('paymentSchedule', value)}
                            type="checkbox"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {form.paymentSchedule === 'other' ? (
                      <DocumentInput
                        ariaLabel="기타 납부 주기"
                        placeholder="기타 납부 주기를 입력해 주세요"
                        value={form.paymentScheduleOther}
                        onChange={(value) =>
                          update('paymentScheduleOther', value)
                        }
                      />
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {[
                        ['online', '온라인 납부'],
                        ['direct', '직접 전달'],
                        ['other', '기타'],
                      ].map(([value, label]) => (
                        <label
                          className="inline-flex items-center gap-1"
                          key={value}
                        >
                          <input
                            aria-label={label}
                            checked={form.paymentMethod === value}
                            className="size-3.5 accent-accent"
                            name="paymentMethod"
                            onChange={() => update('paymentMethod', value)}
                            type="checkbox"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {form.paymentMethod === 'other' ? (
                      <DocumentInput
                        ariaLabel="기타 납부 방법"
                        placeholder="기타 납부 방법을 입력해 주세요"
                        value={form.paymentMethodOther}
                        onChange={(value) =>
                          update('paymentMethodOther', value)
                        }
                      />
                    ) : null}
                  </div>
                </DocumentCell>
              </tr>
              <tr>
                <DocumentGroupHeader>기부금 영수증</DocumentGroupHeader>
                <DocumentLabel required>발급 희망</DocumentLabel>
                <DocumentCell colSpan={3}>
                  <label className="flex items-center gap-2">
                    <input
                      checked={form.receiptRequested}
                      className="size-4 accent-accent"
                      type="checkbox"
                      onChange={(event) =>
                        update('receiptRequested', event.target.checked)
                      }
                    />
                    기부금 영수증 발급을 희망합니다.
                  </label>
                </DocumentCell>
              </tr>
            </tbody>
          </table>
          <section className="border-x-2 border-b-2 border-copy px-3 py-4">
            <h3 className="text-center text-sm font-bold">
              [ 개인정보 수집·이용 및 제공 동의서 ]
            </h3>
            <p className="mt-3 leading-5 text-copy-secondary">
              {organization?.name ?? '기부처'}는 관계 법령에 근거하여 기부금품
              접수 및 이용에 관한 정보주체의 동의절차를 준수하며 개인정보
              제공자가 동의한 이용목적 외의 용도로 이용·제공하지 않습니다.
            </p>
            <h4 className="mt-3 font-bold">■ 개인정보 수집·이용 동의</h4>
            <table className="mt-2 w-full border-collapse border border-copy text-center">
              <thead>
                <tr>
                  <th className="border border-copy p-1">항목</th>
                  <th className="border border-copy p-1">수집·이용 목적</th>
                  <th className="border border-copy p-1">보유 및 이용기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-copy p-1">
                    성명, 주소, 전화번호, 이메일
                  </td>
                  <td className="border border-copy p-1">
                    기부금 관리 및 영수증 발급
                  </td>
                  <td className="border border-copy p-1">
                    관계 법령에 따른 기간
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </section>

        <section className="mx-auto w-full max-w-[820px] border border-copy bg-panel px-4 py-8 text-[11px] leading-5 sm:px-8 sm:py-10 sm:text-xs">
          <h3 className="border-b-2 border-copy pb-3 text-center text-base font-bold">
            개인정보 제공 및 고유식별정보 처리 동의
          </h3>
          <div className="mt-5 grid gap-5">
            <ConsentBlock
              checked={form.personalInfoConsent === true}
              onChange={(value) => update('personalInfoConsent', value)}
              title="개인정보 수집·이용 동의"
            >
              성명, 주소, 연락처 및 이메일을 기부금 관리와 영수증 발급을 위해
              수집·이용하며 관계 법령에 따른 기간 동안 보관합니다.
            </ConsentBlock>
            <ConsentBlock
              checked={form.thirdPartyInfoConsent === true}
              onChange={(value) => update('thirdPartyInfoConsent', value)}
              title="개인정보 제3자 제공 동의"
            >
              기부금 영수증 발급과 기부 내역 관리를 위해 필요한 범위에서 관계
              기관에 정보를 제공할 수 있습니다. 제공 항목과 목적을 확인했으며
              이에 동의합니다.
            </ConsentBlock>
            <ConsentBlock
              checked={form.identityInfoConsent === true}
              onChange={(value) => update('identityInfoConsent', value)}
              title="고유식별정보 처리 안내"
            >
              주민등록번호는 개인 기부자의 증빙을 위해 법적 근거가 확인된
              경우에만 암호화하여 처리합니다. 사업자등록번호는 수집하지
              않습니다.
            </ConsentBlock>
            {form.receiptRequested ? (
              <div className="border border-copy p-3">
                영수증 수령 정보는 위에 입력한 기부자명과 주소를 사용합니다.
              </div>
            ) : null}
            <div className="border-t-2 border-copy pt-6 text-center">
              <p>
                본인은 위 기부 약정 내용과 개인정보 동의 사항을 확인했습니다.
              </p>
              <p className="mt-5 text-sm font-bold">
                {form.pledgeDate || 'YYYY-MM-DD'}
              </p>
              <div className="mt-6 grid grid-cols-[1fr_auto] items-end gap-4 border-b border-copy pb-2 text-left">
                <DocumentInput
                  ariaLabel="최종 기부자명"
                  placeholder="기부자명"
                  value={form.donorName}
                  onChange={(value) => update('donorName', value)}
                />
                <span>서명은 모두싸인에서 진행</span>
              </div>
              <p className="mt-8 text-base font-bold">
                {organization?.name ?? '기부처'} 귀중
              </p>
            </div>
          </div>
        </section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-panel-muted px-6 py-5 sm:px-12">
        <p className="text-xs text-copy-muted">
          서명 요청 후에는 약정 내용을 수정할 수 없습니다.
        </p>
        <div className="flex gap-2">
          <button
            className={buttonClassName({ variant: 'secondary' })}
            type="button"
            onClick={() => router.back()}
          >
            돌아가기
          </button>
          <Button onClick={saveAndContinue} size="large">
            서명하기
          </Button>
        </div>
      </div>
      {error ? (
        <p
          className={cn(
            'border-t border-danger bg-danger/5 px-6 py-3 text-sm text-danger',
            'sm:px-12',
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getPledgeSaveErrorMessage(code?: string) {
  switch (code) {
    case 'identity_number_collection_disabled':
      return '주민등록번호 수집 기능이 비활성화되어 있습니다. 관리자에게 환경 설정을 요청해 주세요.';
    case 'identity_number_configuration_missing':
      return '주민등록번호 암호화 설정이 없어 약정서를 저장할 수 없습니다. 관리자에게 환경 설정을 요청해 주세요.';
    case 'pledge_lookup_failed':
      return '약정서 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    case 'organization_lookup_failed':
      return '기부처 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    case 'pledge_update_failed':
      return '약정서 저장 중 데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    default:
      return undefined;
  }
}

function DocumentGroupHeader({
  children,
  rowSpan,
}: {
  children: ReactNode;
  rowSpan?: number;
}) {
  return (
    <th
      className="w-[18%] border border-copy bg-panel-muted px-1 py-2 text-center font-bold"
      rowSpan={rowSpan}
    >
      {children}
    </th>
  );
}

function DocumentLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <th className="w-[19%] border border-copy bg-panel-muted px-1 py-2 text-center font-bold">
      {children}
      {required ? '*' : ''}
    </th>
  );
}

function DocumentCell({
  children,
  colSpan,
}: {
  children: ReactNode;
  colSpan?: number;
}) {
  return (
    <td className="border border-copy px-1.5 py-1" colSpan={colSpan}>
      {children}
    </td>
  );
}

function DocumentInput({
  ariaLabel,
  onChange,
  type = 'text',
  value,
  ...props
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'aria-label' | 'onChange' | 'type' | 'value'
>) {
  return (
    <input
      aria-label={ariaLabel}
      className="h-8 w-full border-0 border-b border-copy-disabled bg-transparent px-1 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
      onChange={(event) => onChange(event.target.value)}
      type={type}
      value={value}
      {...props}
    />
  );
}

function DocumentTextarea({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <textarea
      aria-label={ariaLabel}
      className="min-h-12 w-full resize-y border-0 bg-transparent px-1 py-1 text-xs outline-none focus:ring-2 focus:ring-accent-soft"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  );
}

function ConsentBlock({
  checked,
  children,
  onChange,
  title,
}: {
  checked: boolean;
  children: ReactNode;
  onChange: (value: boolean) => void;
  title: string;
}) {
  return (
    <section>
      <h4 className="font-bold">■ {title}</h4>
      <p className="mt-2 border border-copy p-3 text-copy-secondary">
        {children}
      </p>
      <div className="mt-2 flex justify-end gap-4 font-bold">
        <label className="inline-flex items-center gap-1">
          <input
            aria-label={`${title} 동의함`}
            checked={checked}
            className="size-3.5 accent-accent"
            onChange={() => onChange(true)}
            type="checkbox"
          />
          동의함
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            aria-label={`${title} 동의하지 않음`}
            checked={!checked}
            className="size-3.5 accent-accent"
            onChange={() => onChange(false)}
            type="checkbox"
          />
          동의하지 않음
        </label>
      </div>
    </section>
  );
}
