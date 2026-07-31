import { PledgeTemplateEditor } from '@/components/partner/pledge-template-editor';
import { RegistrationProgress } from '@/components/partner/registration-progress';

export default function RegistrationPledgeTemplatePage() {
  return (
    <div>
      <RegistrationProgress current={2} />
      <div className="mt-8 max-w-3xl">
        <h1 className="text-2xl font-bold">
          기부처 맞춤 약정서를 만들어 주세요
        </h1>
        <p className="mt-2 text-sm leading-6 text-copy-muted">
          모두기브 표준 조항을 바탕으로 허용할 기부 방식과 집행 공개, 중단, 잔액
          처리 조건을 기부처 운영 정책에 맞게 설정합니다.
        </p>
      </div>
      <PledgeTemplateEditor registrationReturnHref="/partner/register" />
    </div>
  );
}
