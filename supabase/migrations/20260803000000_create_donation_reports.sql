alter table public.donations
  add column if not exists pledge_id uuid references public.pledges(id) on delete restrict;

create unique index if not exists donations_pledge_id_key
  on public.donations (pledge_id)
  where pledge_id is not null;

create table public.donation_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  donation_id uuid not null references public.donations(id) on delete restrict,
  pledge_id uuid not null references public.pledges(id) on delete restrict,
  plan_id uuid not null references public.expenditure_plans(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  status text not null default 'generating'
    check (status in ('generating', 'review_required', 'generation_failed', 'published')),
  title text not null check (char_length(trim(title)) between 1 and 200),
  period_start date not null,
  period_end date not null,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  evidence_snapshot jsonb not null,
  ai_draft jsonb,
  draft_content jsonb,
  published_content jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  model_metadata jsonb,
  generation_error_code text,
  generation_lease_token uuid,
  generation_lease_expires_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  published_event_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_start <= period_end),
  check (jsonb_typeof(evidence_snapshot) = 'object'),
  check (jsonb_typeof(validation_issues) = 'array'),
  check (
    (status = 'published' and published_content is not null and published_at is not null)
    or status <> 'published'
  ),
  unique (created_by, idempotency_key),
  unique (donation_id, period_start, period_end)
);

create index donation_reports_organization_status_updated_idx
  on public.donation_reports (organization_id, status, updated_at desc);
create index donation_reports_pledge_published_idx
  on public.donation_reports (pledge_id, published_at desc)
  where status = 'published';

create table public.donation_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.donation_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  pledge_id uuid not null references public.pledges(id) on delete restrict,
  event_key text not null unique,
  event_type text not null check (event_type = 'report_published'),
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object')
);

alter table public.donation_reports enable row level security;
alter table public.donation_report_events enable row level security;

grant select on public.donation_reports to authenticated;
grant select on public.donation_report_events to authenticated;
grant select, insert, update, delete on public.donation_reports to service_role;
grant select, insert, update, delete on public.donation_report_events to service_role;

create policy "Organization members can read donation reports"
on public.donation_reports for select to authenticated
using (private.is_organization_member(organization_id));

create policy "Donors can read their published donation reports"
on public.donation_reports for select to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.pledges pledge
    where pledge.id = donation_reports.pledge_id
      and pledge.donor_user_id = (select auth.uid())
  )
);

create policy "Organization members can read donation report events"
on public.donation_report_events for select to authenticated
using (private.is_organization_member(organization_id));

create or replace function public.create_donation_report_generation(
  p_actor_id uuid,
  p_organization_id uuid,
  p_donation_id uuid,
  p_pledge_id uuid,
  p_plan_id uuid,
  p_title text,
  p_period_start date,
  p_period_end date,
  p_idempotency_key text,
  p_evidence_snapshot jsonb
)
returns table (
  report_id uuid,
  report_status text,
  evidence_snapshot jsonb,
  lease_token uuid,
  should_generate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_report public.donation_reports%rowtype;
  new_report_id uuid := gen_random_uuid();
  new_lease_token uuid := gen_random_uuid();
begin
  if p_actor_id is null
    or not private.is_organization_member_for(p_organization_id, p_actor_id)
    or p_period_start is null
    or p_period_end is null
    or p_period_start > p_period_end
    or char_length(trim(coalesce(p_title, ''))) not between 1 and 200
    or char_length(coalesce(p_idempotency_key, '')) not between 16 and 200
    or jsonb_typeof(p_evidence_snapshot) is distinct from 'object' then
    raise exception 'Report creation is not allowed';
  end if;

  if not exists (
    select 1
    from public.donations donation
    join public.pledges pledge
      on pledge.id = p_pledge_id
     and pledge.organization_id = donation.organization_id
     and pledge.status = 'signed'
    join public.expenditure_plans plan
      on plan.id = p_plan_id
     and plan.organization_id = donation.organization_id
     and plan.donation_id = donation.id
     and plan.status = 'registered'
    where donation.id = p_donation_id
      and donation.organization_id = p_organization_id
      and donation.pledge_id = pledge.id
      and donation.status = 'paid'
      and exists (
        select 1
        from public.expenditure_executions execution
        where execution.donation_id = donation.id
          and execution.plan_id = plan.id
          and execution.status = 'registered'
      )
  ) then
    raise exception 'Report references are not eligible';
  end if;

  select * into existing_report
  from public.donation_reports report
  where report.created_by = p_actor_id
    and report.idempotency_key = p_idempotency_key
  for update;

  if found then
    if existing_report.organization_id is distinct from p_organization_id
      or existing_report.donation_id is distinct from p_donation_id
      or existing_report.pledge_id is distinct from p_pledge_id
      or existing_report.plan_id is distinct from p_plan_id
      or existing_report.period_start is distinct from p_period_start
      or existing_report.period_end is distinct from p_period_end
      or existing_report.evidence_snapshot is distinct from p_evidence_snapshot then
      raise exception 'Report idempotency key does not match';
    end if;

    if existing_report.status = 'generating'
      and (
        existing_report.generation_lease_expires_at is null
        or existing_report.generation_lease_expires_at <= now()
      ) then
      update public.donation_reports report
      set generation_lease_token = new_lease_token,
          generation_lease_expires_at = now() + interval '2 minutes',
          updated_at = now()
      where report.id = existing_report.id;
      return query select
        existing_report.id,
        'generating'::text,
        existing_report.evidence_snapshot,
        new_lease_token,
        true;
      return;
    end if;

    return query select
      existing_report.id,
      existing_report.status,
      existing_report.evidence_snapshot,
      null::uuid,
      false;
    return;
  end if;

  insert into public.donation_reports (
    id,
    organization_id,
    donation_id,
    pledge_id,
    plan_id,
    created_by,
    title,
    period_start,
    period_end,
    idempotency_key,
    evidence_snapshot,
    generation_lease_token,
    generation_lease_expires_at
  ) values (
    new_report_id,
    p_organization_id,
    p_donation_id,
    p_pledge_id,
    p_plan_id,
    p_actor_id,
    trim(p_title),
    p_period_start,
    p_period_end,
    p_idempotency_key,
    p_evidence_snapshot,
    new_lease_token,
    now() + interval '2 minutes'
  );

  return query select
    new_report_id,
    'generating'::text,
    p_evidence_snapshot,
    new_lease_token,
    true;
end;
$$;

create or replace function public.save_donation_report_generation(
  p_actor_id uuid,
  p_report_id uuid,
  p_lease_token uuid,
  p_ai_draft jsonb,
  p_validation_issues jsonb,
  p_model_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_ai_draft) is distinct from 'object'
    or jsonb_typeof(p_validation_issues) is distinct from 'array'
    or jsonb_array_length(p_validation_issues) > 0
    or jsonb_typeof(p_model_metadata) is distinct from 'object' then
    raise exception 'Generated report payload is invalid';
  end if;

  update public.donation_reports report
  set status = 'review_required',
      ai_draft = p_ai_draft,
      draft_content = p_ai_draft,
      validation_issues = p_validation_issues,
      model_metadata = p_model_metadata,
      generation_error_code = null,
      generation_lease_token = null,
      generation_lease_expires_at = null,
      updated_at = now()
  where report.id = p_report_id
    and report.status = 'generating'
    and report.generation_lease_token = p_lease_token
    and private.is_organization_member_for(report.organization_id, p_actor_id);

  if not found then
    raise exception 'Report generation is not writable';
  end if;
end;
$$;

create or replace function public.mark_donation_report_generation_failed(
  p_actor_id uuid,
  p_report_id uuid,
  p_lease_token uuid,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.donation_reports report
  set status = 'generation_failed',
      generation_error_code = left(coalesce(p_error_code, 'generation_failed'), 100),
      generation_lease_token = null,
      generation_lease_expires_at = null,
      updated_at = now()
  where report.id = p_report_id
    and report.status = 'generating'
    and report.generation_lease_token = p_lease_token
    and private.is_organization_member_for(report.organization_id, p_actor_id);

  if not found then
    raise exception 'Report generation failure is not writable';
  end if;
end;
$$;

create or replace function public.claim_donation_report_retry(
  p_actor_id uuid,
  p_report_id uuid
)
returns table (
  report_id uuid,
  evidence_snapshot jsonb,
  lease_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.donation_reports report
  set status = 'generating',
      generation_error_code = null,
      generation_lease_token = gen_random_uuid(),
      generation_lease_expires_at = now() + interval '2 minutes',
      updated_at = now()
  where report.id = p_report_id
    and (
      report.status = 'generation_failed'
      or (
        report.status = 'generating'
        and (
          report.generation_lease_expires_at is null
          or report.generation_lease_expires_at <= now()
        )
      )
    )
    and private.is_organization_member_for(report.organization_id, p_actor_id)
  returning report.id, report.evidence_snapshot, report.generation_lease_token;
end;
$$;

create or replace function public.save_donation_report_draft(
  p_actor_id uuid,
  p_report_id uuid,
  p_draft_content jsonb,
  p_validation_issues jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_draft_content) is distinct from 'object'
    or jsonb_typeof(p_validation_issues) is distinct from 'array' then
    raise exception 'Report draft payload is invalid';
  end if;

  update public.donation_reports report
  set draft_content = p_draft_content,
      validation_issues = p_validation_issues,
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      updated_at = now()
  where report.id = p_report_id
    and report.status = 'review_required'
    and private.is_organization_member_for(report.organization_id, p_actor_id);

  if not found then
    raise exception 'Report draft is not writable';
  end if;
end;
$$;

create or replace function public.publish_donation_report(
  p_actor_id uuid,
  p_report_id uuid,
  p_draft_content jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_report public.donation_reports%rowtype;
  target_event_key text;
begin
  select * into target_report
  from public.donation_reports report
  where report.id = p_report_id
    and private.is_organization_member_for(report.organization_id, p_actor_id)
  for update;

  if not found then
    raise exception 'Report not found';
  end if;

  if target_report.status = 'published' then
    if target_report.published_content = p_draft_content then
      return target_report.published_event_key;
    end if;
    raise exception 'Report already published with different content';
  end if;

  if target_report.status <> 'review_required'
    or jsonb_typeof(p_draft_content) is distinct from 'object'
    or jsonb_array_length(target_report.validation_issues) > 0 then
    raise exception 'Report is not publishable';
  end if;

  target_event_key := 'report_published:' || target_report.id::text;

  update public.donation_reports
  set status = 'published',
      draft_content = p_draft_content,
      published_content = p_draft_content,
      reviewed_by = coalesce(reviewed_by, p_actor_id),
      reviewed_at = coalesce(reviewed_at, now()),
      published_by = p_actor_id,
      published_at = now(),
      published_event_key = target_event_key,
      updated_at = now()
  where id = target_report.id;

  insert into public.donation_report_events (
    report_id,
    organization_id,
    pledge_id,
    event_key,
    event_type,
    payload
  ) values (
    target_report.id,
    target_report.organization_id,
    target_report.pledge_id,
    target_event_key,
    'report_published',
    jsonb_build_object(
      'reportId', target_report.id,
      'organizationId', target_report.organization_id,
      'pledgeId', target_report.pledge_id
    )
  ) on conflict (report_id) do nothing;

  return target_event_key;
end;
$$;

revoke all on function public.create_donation_report_generation(
  uuid, uuid, uuid, uuid, uuid, text, date, date, text, jsonb
) from public;
revoke all on function public.save_donation_report_generation(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public;
revoke all on function public.mark_donation_report_generation_failed(
  uuid, uuid, uuid, text
) from public;
revoke all on function public.claim_donation_report_retry(uuid, uuid) from public;
revoke all on function public.save_donation_report_draft(
  uuid, uuid, jsonb, jsonb
) from public;
revoke all on function public.publish_donation_report(uuid, uuid, jsonb) from public;

grant execute on function public.create_donation_report_generation(
  uuid, uuid, uuid, uuid, uuid, text, date, date, text, jsonb
) to service_role;
grant execute on function public.save_donation_report_generation(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.mark_donation_report_generation_failed(
  uuid, uuid, uuid, text
) to service_role;
grant execute on function public.claim_donation_report_retry(uuid, uuid) to service_role;
grant execute on function public.save_donation_report_draft(
  uuid, uuid, jsonb, jsonb
) to service_role;
grant execute on function public.publish_donation_report(uuid, uuid, jsonb) to service_role;
