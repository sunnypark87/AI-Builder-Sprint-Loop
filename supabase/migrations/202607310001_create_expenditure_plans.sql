do $$
begin
  if to_regclass('public.organizations') is null
    or to_regclass('public.organization_members') is null
    or to_regclass('public.donations') is null then
    raise exception
      'Issue #7 requires public.organizations, public.organization_members, and public.donations';
  end if;
end
$$;

create schema if not exists private;

create or replace function private.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_organization_member(uuid) from public;
grant execute on function private.is_organization_member(uuid) to authenticated;

create or replace function private.is_organization_member_for(
  target_organization_id uuid,
  actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = actor_user_id
  );
$$;

revoke all on function private.is_organization_member_for(uuid, uuid)
  from public;

create or replace function private.can_access_plan_document(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  organization_id uuid;
begin
  organization_id := (storage.foldername(object_name))[1]::uuid;
  return private.is_organization_member(organization_id);
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function private.can_access_plan_document(text) from public;
grant execute on function private.can_access_plan_document(text) to authenticated;

create table public.expenditure_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  donation_id uuid not null references public.donations(id),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  status text not null default 'analyzing'
    check (status in ('analyzing', 'review_required', 'registered', 'analysis_failed')),
  title text check (title is null or char_length(trim(title)) between 1 and 200),
  period_start date,
  period_end date,
  total_amount bigint
    check (total_amount is null or total_amount between 1 and 1000000000000),
  draft_data jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  source_path text,
  source_file_name text not null check (char_length(source_file_name) between 1 and 200),
  source_mime_type text not null
    check (source_mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  source_size_bytes bigint not null check (source_size_bytes > 0),
  source_page_count integer not null check (source_page_count >= 0 and source_page_count <= 30),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  ocr_metadata jsonb,
  analysis_error_code text,
  analysis_lease_expires_at timestamptz,
  idempotency_key text not null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, idempotency_key),
  check (period_end is null or period_start is null or period_start <= period_end)
);

create table public.expenditure_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.expenditure_plans(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 1000),
  amount bigint not null check (amount between 1 and 1000000000000),
  sort_order integer not null check (sort_order >= 0),
  source_confidence numeric check (source_confidence between 0 and 1),
  source_text text not null default '',
  edited_by_reviewer boolean not null default false,
  unique (plan_id, sort_order)
);

create table public.plan_ocr_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.expenditure_plans(id) on delete cascade,
  provider text not null check (provider = 'upstage'),
  api_version text not null,
  model_version text not null,
  page_count integer not null check (page_count > 0 and page_count <= 30),
  processed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index expenditure_plans_organization_id_idx
  on public.expenditure_plans(organization_id);
create index expenditure_plans_donation_id_idx
  on public.expenditure_plans(donation_id);
create index expenditure_plan_items_plan_id_idx
  on public.expenditure_plan_items(plan_id);
create index plan_ocr_runs_plan_id_idx
  on public.plan_ocr_runs(plan_id);

alter table public.expenditure_plans enable row level security;
alter table public.expenditure_plan_items enable row level security;
alter table public.plan_ocr_runs enable row level security;

grant select on public.expenditure_plans to authenticated;
grant select on public.expenditure_plan_items to authenticated;
grant select on public.plan_ocr_runs to authenticated;
grant select, insert, update, delete on public.expenditure_plans
  to service_role;
grant select, insert, update, delete on public.expenditure_plan_items
  to service_role;
grant select, insert, update, delete on public.plan_ocr_runs
  to service_role;

create policy "Organization members can read plans"
on public.expenditure_plans for select to authenticated
using (private.is_organization_member(organization_id));

create policy "Organization members can read plan items"
on public.expenditure_plan_items for select to authenticated
using (
  exists (
    select 1
    from public.expenditure_plans plan
    where plan.id = plan_id
      and private.is_organization_member(plan.organization_id)
  )
);

create policy "Organization members can read OCR runs"
on public.plan_ocr_runs for select to authenticated
using (
  exists (
    select 1
    from public.expenditure_plans plan
    where plan.id = plan_id
      and private.is_organization_member(plan.organization_id)
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'plan-documents',
  'plan-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Organization members can read plan documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'plan-documents'
  and private.can_access_plan_document(name)
);

create or replace function public.create_expenditure_plan_analysis(
  p_actor_id uuid,
  p_organization_id uuid,
  p_donation_id uuid,
  p_idempotency_key text,
  p_source_file_name text,
  p_source_mime_type text,
  p_source_size_bytes bigint,
  p_source_page_count integer,
  p_source_fingerprint text
)
returns table (
  plan_id uuid,
  plan_status text,
  plan_draft jsonb,
  plan_validation_issues jsonb,
  should_process boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  process_plan_id uuid;
begin
  if p_actor_id is null
    or not private.is_organization_member_for(p_organization_id, p_actor_id)
    or not exists (
      select 1
      from public.donations donation
      where donation.id = p_donation_id
        and donation.organization_id = p_organization_id
        and donation.status = 'paid'
    ) then
    raise exception 'Plan creation is not allowed';
  end if;

  insert into public.expenditure_plans (
    organization_id,
    donation_id,
    created_by,
    status,
    source_file_name,
    source_mime_type,
    source_size_bytes,
    source_page_count,
    source_fingerprint,
    idempotency_key,
    analysis_lease_expires_at
  )
  values (
    p_organization_id,
    p_donation_id,
    p_actor_id,
    'analyzing',
    p_source_file_name,
    p_source_mime_type,
    p_source_size_bytes,
    p_source_page_count,
    p_source_fingerprint,
    p_idempotency_key,
    now() + interval '2 minutes'
  )
  on conflict (created_by, idempotency_key) do nothing
  returning id into process_plan_id;

  if process_plan_id is null then
    update public.expenditure_plans plan
    set analysis_lease_expires_at = now() + interval '2 minutes',
        updated_at = now()
    where plan.created_by = p_actor_id
      and plan.idempotency_key = p_idempotency_key
      and plan.organization_id = p_organization_id
      and plan.donation_id = p_donation_id
      and plan.status = 'analyzing'
      and (
        plan.analysis_lease_expires_at is null
        or plan.analysis_lease_expires_at <= now()
      )
    returning plan.id into process_plan_id;
  end if;

  if process_plan_id is not null then
    return query
    select
      plan.id,
      plan.status,
      plan.draft_data,
      plan.validation_issues,
      true
    from public.expenditure_plans plan
    where plan.id = process_plan_id;
    return;
  end if;

  return query
  select
    plan.id,
    plan.status,
    plan.draft_data,
    plan.validation_issues,
    false
  from public.expenditure_plans plan
  where plan.created_by = p_actor_id
    and plan.idempotency_key = p_idempotency_key
    and plan.organization_id = p_organization_id
    and plan.donation_id = p_donation_id;
end;
$$;

create or replace function public.mark_plan_source_uploaded(
  p_actor_id uuid,
  p_plan_id uuid,
  p_source_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.expenditure_plans
  set source_path = p_source_path,
      updated_at = now()
  where id = p_plan_id
    and status = 'analyzing'
    and private.is_organization_member_for(organization_id, p_actor_id)
    and p_source_path like
      organization_id::text || '/' || id::text || '/source.%';

  if not found then
    raise exception 'Plan is not available for source recording';
  end if;
end;
$$;

create or replace function public.save_plan_analysis(
  p_actor_id uuid,
  p_plan_id uuid,
  p_source_path text,
  p_draft jsonb,
  p_validation_issues jsonb,
  p_ocr_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.expenditure_plans
  set source_path = p_source_path,
      draft_data = p_draft,
      validation_issues = p_validation_issues,
      ocr_metadata = p_ocr_metadata,
      status = 'review_required',
      analysis_error_code = null,
      analysis_lease_expires_at = null,
      updated_at = now()
  where id = p_plan_id
    and status = 'analyzing'
    and private.is_organization_member_for(organization_id, p_actor_id);

  if not found then
    raise exception 'Plan is not available for analysis';
  end if;

  insert into public.plan_ocr_runs (
    plan_id,
    provider,
    api_version,
    model_version,
    page_count,
    processed_at
  )
  values (
    p_plan_id,
    'upstage',
    p_ocr_metadata->>'apiVersion',
    p_ocr_metadata->>'modelVersion',
    (p_ocr_metadata->>'pageCount')::integer,
    (p_ocr_metadata->>'processedAt')::timestamptz
  );
end;
$$;

create or replace function public.mark_plan_analysis_failed(
  p_actor_id uuid,
  p_plan_id uuid,
  p_error_code text,
  p_source_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.expenditure_plans
  set status = 'analysis_failed',
      analysis_error_code = p_error_code,
      source_path = coalesce(p_source_path, source_path),
      analysis_lease_expires_at = null,
      updated_at = now()
  where id = p_plan_id
    and status = 'analyzing'
    and private.is_organization_member_for(organization_id, p_actor_id);

  if not found then
    raise exception 'Plan is not available for failure recording';
  end if;
end;
$$;

create or replace function public.claim_plan_analysis_retry(
  p_actor_id uuid,
  p_plan_id uuid
)
returns table (
  plan_id uuid,
  organization_id uuid,
  source_path text,
  source_file_name text,
  source_mime_type text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.expenditure_plans plan
  set status = 'analyzing',
      analysis_error_code = null,
      analysis_lease_expires_at = now() + interval '2 minutes',
      updated_at = now()
  where plan.id = p_plan_id
    and (
      plan.status = 'analysis_failed'
      or (
        plan.status = 'analyzing'
        and plan.analysis_lease_expires_at <= now()
      )
    )
    and plan.source_path is not null
    and private.is_organization_member_for(plan.organization_id, p_actor_id)
  returning
    plan.id,
    plan.organization_id,
    plan.source_path,
    plan.source_file_name,
    plan.source_mime_type;
end;
$$;

create or replace function public.register_expenditure_plan(
  p_actor_id uuid,
  p_plan_id uuid,
  p_draft jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  expected_total bigint;
  item_total bigint;
begin
  select plan.status
  into current_status
  from public.expenditure_plans plan
  where plan.id = p_plan_id
    and private.is_organization_member_for(plan.organization_id, p_actor_id)
    and exists (
      select 1
      from public.donations donation
      where donation.id = plan.donation_id
        and donation.organization_id = plan.organization_id
        and donation.status = 'paid'
    )
  for update;

  if current_status = 'registered' then
    return;
  end if;

  if current_status is distinct from 'review_required' then
    raise exception 'Plan is not available for registration';
  end if;

  if coalesce(trim(p_draft->>'title'), '') = ''
    or char_length(trim(p_draft->>'title')) > 200
    or coalesce(p_draft->>'periodStart', '') = ''
    or coalesce(p_draft->>'periodEnd', '') = ''
    or (p_draft->>'periodStart')::date > (p_draft->>'periodEnd')::date
    or coalesce(jsonb_array_length(p_draft->'items'), 0) = 0
    or jsonb_array_length(p_draft->'items') > 100 then
    raise exception 'Required plan fields are missing';
  end if;

  expected_total := (p_draft->>'totalAmount')::bigint;
  select coalesce(sum(item.amount), 0)
  into item_total
  from jsonb_to_recordset(p_draft->'items') as item(amount bigint);

  if expected_total is null
    or expected_total not between 1 and 1000000000000
    or item_total <> expected_total then
    raise exception 'Plan item total does not match';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_draft->'items') as item(
      name text,
      description text,
      amount bigint
    )
    where coalesce(trim(item.name), '') = ''
      or char_length(trim(item.name)) > 200
      or char_length(coalesce(item.description, '')) > 1000
      or item.amount not between 1 and 1000000000000
  ) then
    raise exception 'Plan item fields are invalid';
  end if;

  update public.expenditure_plans
  set title = trim(p_draft->>'title'),
      period_start = (p_draft->>'periodStart')::date,
      period_end = (p_draft->>'periodEnd')::date,
      total_amount = expected_total,
      draft_data = p_draft,
      validation_issues = '[]'::jsonb,
      status = 'registered',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      updated_at = now()
  where id = p_plan_id;

  delete from public.expenditure_plan_items where plan_id = p_plan_id;

  insert into public.expenditure_plan_items (
    plan_id,
    name,
    description,
    amount,
    sort_order,
    source_confidence,
    source_text,
    edited_by_reviewer
  )
  select
    p_plan_id,
    trim(element.value->>'name'),
    coalesce(element.value->>'description', ''),
    (element.value->>'amount')::bigint,
    element.ordinality - 1,
    (element.value->>'confidence')::numeric,
    coalesce(element.value->>'sourceText', ''),
    trim(element.value->>'name') <> trim(element.value->>'sourceName')
      or (element.value->>'amount')::bigint
        is distinct from (element.value->>'sourceAmount')::bigint
  from jsonb_array_elements(p_draft->'items') with ordinality
    as element(value, ordinality);
end;
$$;

revoke all on function public.save_plan_analysis(uuid, uuid, text, jsonb, jsonb, jsonb)
  from public;
revoke all on function public.create_expenditure_plan_analysis(uuid, uuid, uuid, text, text, text, bigint, integer, text)
  from public;
revoke all on function public.mark_plan_source_uploaded(uuid, uuid, text)
  from public;
revoke all on function public.mark_plan_analysis_failed(uuid, uuid, text, text)
  from public;
revoke all on function public.claim_plan_analysis_retry(uuid, uuid)
  from public;
revoke all on function public.register_expenditure_plan(uuid, uuid, jsonb)
  from public;
grant execute on function public.create_expenditure_plan_analysis(uuid, uuid, uuid, text, text, text, bigint, integer, text)
  to service_role;
grant execute on function public.mark_plan_source_uploaded(uuid, uuid, text)
  to service_role;
grant execute on function public.save_plan_analysis(uuid, uuid, text, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.mark_plan_analysis_failed(uuid, uuid, text, text)
  to service_role;
grant execute on function public.claim_plan_analysis_retry(uuid, uuid)
  to service_role;
grant execute on function public.register_expenditure_plan(uuid, uuid, jsonb)
  to service_role;
