import { PageHeader } from '@/components/partner/page-header';
import { PledgeTemplateEditor } from '@/components/partner/pledge-template-editor';

export default function PledgeTemplateSettingsPage() {
  return (
    <div>
      <PageHeader
        title="약정서 템플릿"
        description="모두기브 표준 약정서에 기부처 고유 조건을 설정합니다."
      />
      <PledgeTemplateEditor mode="settings" />
    </div>
  );
}
