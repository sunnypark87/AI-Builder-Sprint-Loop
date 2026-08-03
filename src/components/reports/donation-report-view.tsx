import { Card } from '@/components/ui/card';
import type { ReportContent, ReportEvidence } from '@/lib/reports/types';

function money(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function DonationReportView({
  content,
  evidence,
}: {
  content: ReportContent;
  evidence: ReportEvidence;
}) {
  return (
    <div className="grid gap-6">
      <section>
        <h2 className="text-xl font-bold">{content.title}</h2>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-copy-secondary">
          {content.summary.text}
        </p>
      </section>
      <Card className="p-5">
        <h2 className="font-bold">검증된 집행 요약</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-copy-muted">계획 예산</dt>
            <dd className="mt-1 font-bold">
              {money(evidence.plan.totalAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-copy-muted">실제 집행</dt>
            <dd className="mt-1 font-bold">
              {money(evidence.plan.spentAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-copy-muted">잔액</dt>
            <dd className="mt-1 font-bold">
              {money(evidence.plan.remainingAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-copy-muted">등록 집행</dt>
            <dd className="mt-1 font-bold">{evidence.plan.executionCount}건</dd>
          </div>
        </dl>
      </Card>
      <section>
        <h2 className="font-bold">계획 대비 집행</h2>
        <p className="mt-2 whitespace-pre-wrap leading-7 text-copy-secondary">
          {content.planComparison.text}
        </p>
      </section>
      <section>
        <h2 className="font-bold">항목별 사용 내역</h2>
        <div className="mt-3 divide-y divide-line border-y border-line">
          {evidence.plan.items.map((item) => {
            const narrative = content.items.find(
              (candidate) => candidate.planItemId === item.id,
            );
            return (
              <article
                className="grid gap-3 py-5 sm:grid-cols-[1fr_auto]"
                key={item.id}
              >
                <div>
                  <h3 className="font-bold">{item.name}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-copy-secondary">
                    {narrative?.text}
                  </p>
                </div>
                <dl className="text-sm sm:text-right">
                  <dt className="text-copy-muted">계획 / 집행</dt>
                  <dd className="mt-1 font-medium">
                    {money(item.plannedAmount)} / {money(item.spentAmount)}
                  </dd>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
      <section className="grid gap-5 sm:grid-cols-2">
        <div>
          <h2 className="font-bold">성과</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-copy-secondary">
            {content.outcomes.text}
          </p>
        </div>
        <div>
          <h2 className="font-bold">향후 계획</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-copy-secondary">
            {content.nextSteps.text}
          </p>
        </div>
      </section>
    </div>
  );
}
