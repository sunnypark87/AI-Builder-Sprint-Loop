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

grant select, insert, update on public.expenditure_plans to authenticated;
grant select, insert, update, delete on public.expenditure_plan_items
  to authenticated;
grant select, insert on public.plan_ocr_runs to authenticated;
grant select, insert, update, delete on public.expenditure_plans
  to service_role;
grant select, insert, update, delete on public.expenditure_plan_items
  to service_role;
grant select, insert, update, delete on public.plan_ocr_runs
  to service_role;

create policy "Organization members can read plans"
on public.expenditure_plans for select to authenticated
using (private.is_organization_member(organization_id));

create policy "Organization members can create plans"
on public.expenditure_plans for insert to authenticated
with check (
  (select auth.uid()) = created_by
  and private.is_organization_member(organization_id)
  and exists (
    select 1
    from public.donations donation
    where donation.id = donation_id
      and donation.organization_id = organization_id
  )
);

create policy "Organization members can update plans"
on public.expenditure_plans for update to authenticated
using (private.is_organization_member(organization_id))
with check (private.is_organization_member(organization_id));

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

create policy "Organization members can manage plan items"
on public.expenditure_plan_items for all to authenticated
using (
  exists (
    select 1
    from public.expenditure_plans plan
    where plan.id = plan_id
      and private.is_organization_member(plan.organization_id)
  )
)
with check (
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

create policy "Organization members can create OCR runs"
on public.plan_ocr_runs for insert to authenticated
with check (
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

create policy "Organization members can upload plan documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'plan-documents'
  and private.can_access_plan_document(name)
);

create policy "Organization members can delete plan documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'plan-documents'
  and private.can_access_plan_document(name)
);

create or replace function public.save_plan_analysis(
  p_plan_id uuid,
  p_source_path text,
  p_draft jsonb,
  p_validation_issues jsonb,
  p_ocr_metadata jsonb
)
returns void
language plpgsql
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
      updated_at = now()
  where id = p_plan_id
    and status = 'analyzing';

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

create or replace function public.register_expenditure_plan(
  p_plan_id uuid,
  p_draft jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_status text;
  expected_total bigint;
  item_total bigint;
begin
  select status
  into current_status
  from public.expenditure_plans
  where id = p_plan_id
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
      reviewed_by = (select auth.uid()),
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

revoke all on function public.save_plan_analysis(uuid, text, jsonb, jsonb, jsonb)
  from public;
revoke all on function public.register_expenditure_plan(uuid, jsonb)
  from public;
grant execute on function public.save_plan_analysis(uuid, text, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.register_expenditure_plan(uuid, jsonb)
  to authenticated;
grant execute on function public.save_plan_analysis(uuid, text, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.register_expenditure_plan(uuid, jsonb)
  to service_role;
