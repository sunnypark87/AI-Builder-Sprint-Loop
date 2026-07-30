'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { RegistrationProgress } from '@/components/partner/registration-progress';
import { buttonClassName } from '@/components/ui/button';
import { InlineNotice } from '@/components/ui/inline-notice';
import { Input } from '@/components/ui/input';

const selectClassName =
  'h-10 w-full rounded-[var(--radius-sm)] border border-line bg-panel px-3 text-sm text-copy hover:border-copy-disabled';
const textareaClassName =
  'min-h-28 w-full resize-y rounded-[var(--radius-sm)] border border-line bg-panel px-3 py-2.5 text-sm leading-6 text-copy placeholder:text-copy-disabled hover:border-copy-disabled';

export default function PartnerRegisterPage() {
  const router = useRouter();

  return (
    <div className="max-w-[960px]">
      <RegistrationProgress current={1} />
      <div className="mt-8">
        <h1 className="text-2xl font-bold">기부처 정보를 입력해 주세요</h1>
        <p className="mt-2 text-sm leading-6 text-copy-muted">
          기부자에게 공개할 단체 정보와 약정·집행 업무를 담당할 연락처를
          입력합니다.
        </p>
      </div>

      <InlineNotice className="mt-6" title="데모 등록 화면">
        입력 내용과 첨부 파일은 저장되거나 실제 심사에 사용되지 않습니다.
      </InlineNotice>

      <form
        className="mt-8 grid gap-10"
        onSubmit={(event) => {
          event.preventDefault();
          router.push('/partner/register/pledge-template');
        }}
      >
        <fieldset className="grid gap-5 border-t border-line pt-6">
          <legend className="pr-4 text-lg font-bold">단체 기본 정보</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              defaultValue="해봄재단"
              label="기부처명"
              name="organizationName"
              required
            />
            <label className="grid gap-1.5 text-sm font-medium">
              단체 유형
              <select
                className={selectClassName}
                defaultValue="foundation"
                name="organizationType"
                required
              >
                <option value="foundation">비영리 재단법인</option>
                <option value="association">비영리 사단법인</option>
                <option value="ngo">비정부기구·비영리민간단체</option>
                <option value="social">사회복지법인·시설</option>
                <option value="other">기타</option>
              </select>
            </label>
            <Input
              defaultValue="123-45-67890"
              description="공개 화면에는 확인 여부만 표시합니다."
              label="고유번호 또는 사업자등록번호"
              name="registrationNumber"
              required
            />
            <Input
              defaultValue="김해봄"
              label="대표자명"
              name="representativeName"
              required
            />
            <Input
              className="sm:col-span-2"
              defaultValue="서울특별시 종로구 모두길 12"
              label="소재지"
              name="address"
              required
            />
            <Input
              defaultValue="https://example.org"
              label="공식 웹사이트"
              name="website"
              type="url"
            />
            <label className="grid gap-1.5 text-sm font-medium">
              주요 활동 분야
              <select
                className={selectClassName}
                defaultValue="children"
                name="category"
                required
              >
                <option value="children">아동·청소년</option>
                <option value="environment">환경</option>
                <option value="community">지역사회</option>
                <option value="animal">동물</option>
                <option value="international">국제구호</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            기부처 소개
            <textarea
              className={textareaClassName}
              defaultValue="돌봄 공백 아동의 방과 후 배움과 식사를 지원합니다."
              maxLength={300}
              name="description"
              required
            />
            <span className="text-xs font-normal text-copy-muted">
              기부처 목록과 상세 화면에 공개됩니다. 300자 이내
            </span>
          </label>
        </fieldset>

        <fieldset className="grid gap-5 border-t border-line pt-6">
          <legend className="pr-4 text-lg font-bold">업무 담당자</legend>
          <p className="text-sm leading-6 text-copy-muted">
            약정 서명, 집행 계획 검토와 보고서 발행 알림을 받을 담당자입니다.
            기부자에게는 공개하지 않습니다.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              defaultValue="박모두"
              label="담당자명"
              name="managerName"
              required
            />
            <Input
              defaultValue="기부사업팀 팀장"
              label="부서·직책"
              name="managerRole"
            />
            <Input
              defaultValue="manager@example.org"
              label="업무 이메일"
              name="managerEmail"
              required
              type="email"
            />
            <Input
              defaultValue="02-1234-5678"
              label="업무 연락처"
              name="managerPhone"
              required
              type="tel"
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-5 border-t border-line pt-6">
          <legend className="pr-4 text-lg font-bold">확인 자료</legend>
          <p className="text-sm leading-6 text-copy-muted">
            단체 정보 확인을 위한 자료입니다. 기부자에게 원본 전체가 공개되지는
            않습니다.
          </p>
          <label className="grid gap-1.5 text-sm font-medium">
            고유번호증 또는 사업자등록증
            <input
              accept=".pdf,.png,.jpg,.jpeg"
              className="min-h-12 rounded-[var(--radius-sm)] border border-dashed border-line px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-panel-muted file:px-3 file:py-1.5 file:text-sm"
              name="verificationDocument"
              type="file"
            />
            <span className="text-xs font-normal text-copy-muted">
              PDF, PNG, JPG · 데모 화면에서는 업로드되지 않습니다.
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <Link className={buttonClassName({ variant: 'secondary' })} href="/">
            나중에 등록하기
          </Link>
          <button className={buttonClassName({ size: 'large' })} type="submit">
            저장하고 약정서 만들기
          </button>
        </div>
      </form>
    </div>
  );
}
