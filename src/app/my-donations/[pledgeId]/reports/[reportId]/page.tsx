import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { DonationReportView } from '@/components/reports/donation-report-view';
import { parseReportEvidence } from '@/lib/reports/report-evidence';
import { parseReportContent } from '@/lib/reports/report-schema';
import { getCurrentUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ pledgeId: string; reportId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { pledgeId, reportId } = await params;
  const { data } = await (
    await createClient()
  )
    .from('donation_reports')
    .select('id,title,evidence_snapshot,published_content,published_at')
    .eq('id', reportId)
    .eq('pledge_id', pledgeId)
    .eq('status', 'published')
    .maybeSingle();
  const evidence = parseReportEvidence(data?.evidence_snapshot);
  const content = parseReportContent(data?.published_content);
  if (!data || !evidence || !content) notFound();
  return (
    <main className="mx-auto max-w-[900px] px-4 py-12 md:px-6">
      <Link
        className="text-sm text-copy-muted underline underline-offset-4"
        href={`/my-donations/${pledgeId}`}
      >
        기부 상세로 돌아가기
      </Link>
      <p className="mt-8 text-sm text-copy-muted">발행된 기부 집행 보고서</p>
      <h1 className="mt-2 text-3xl font-bold">{content.title}</h1>
      <p className="mt-2 text-sm text-copy-muted">
        {new Date(data.published_at as string).toLocaleDateString('ko-KR')} 발행
      </p>
      <div className="mt-8">
        <DonationReportView content={content} evidence={evidence} />
      </div>
    </main>
  );
}
