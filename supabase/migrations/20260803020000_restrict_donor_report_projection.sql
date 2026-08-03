drop policy if exists "Donors can read their published donation reports"
  on public.donation_reports;

create or replace function public.get_published_donation_reports(
  p_pledge_id uuid
)
returns table (
  id uuid,
  title text,
  period_start date,
  period_end date,
  evidence_snapshot jsonb,
  published_content jsonb,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    report.id,
    report.title,
    report.period_start,
    report.period_end,
    report.evidence_snapshot,
    report.published_content,
    report.published_at
  from public.donation_reports as report
  inner join public.pledges as pledge on pledge.id = report.pledge_id
  where report.pledge_id = p_pledge_id
    and report.status = 'published'
    and pledge.donor_user_id = (select auth.uid())
  order by report.published_at desc;
$$;

revoke all on function public.get_published_donation_reports(uuid) from public;
grant execute on function public.get_published_donation_reports(uuid)
  to authenticated;
