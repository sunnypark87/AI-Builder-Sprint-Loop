alter table public.donations
  add column if not exists paid_at timestamptz,
  add column if not exists paid_at_is_authoritative boolean not null default false;

update public.donations
set paid_at = created_at
where status = 'paid' and paid_at is null;

comment on column public.donations.paid_at_is_authoritative is
  'True only when paid_at comes from an authoritative payment confirmation; legacy created_at backfills remain false.';

create or replace function private.can_access_receipt_document(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then private.is_organization_member(
      split_part(object_name, '/', 1)::uuid
    )
    else false
  end;
$$;

create table public.expenditure_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  donation_id uuid not null references public.donations(id),
  plan_id uuid not null references public.expenditure_plans(id),
  plan_item_id uuid not null references public.expenditure_plan_items(id),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  status text not null default 'analyzing'
    check (status in (
      'analyzing',
      'review_required',
      'verification_warning',
      'registered',
      'analysis_failed'
    )),
  merchant_name text check (
    merchant_name is null or char_length(trim(merchant_name)) between 1 and 200
  ),
  business_number text check (
    business_number is null or business_number ~ '^[0-9]{10}$'
  ),
  transaction_at timestamp,
  supply_amount bigint check (supply_amount is null or supply_amount >= 0),
  tax_amount bigint check (tax_amount is null or tax_amount >= 0),
  total_amount bigint check (
    total_amount is null or total_amount between 1 and 1000000000000
  ),
  payment_method text not null default '' check (char_length(payment_method) <= 100),
  approval_number text not null default '' check (char_length(approval_number) <= 40),
  draft_data jsonb,
  ocr_draft_data jsonb,
  validation_issues jsonb not null default '[]'::jsonb,
  verification_results jsonb not null default '[]'::jsonb,
  warning_reason text not null default '' check (char_length(warning_reason) <= 1000),
  semantic_key text check (
    semantic_key is null or char_length(semantic_key) between 1 and 500
  ),
  idempotency_key text not null check (
    char_length(idempotency_key) between 16 and 128
  ),
  analysis_error_code text,
  analysis_lease_expires_at timestamptz,
  analysis_lease_token uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, idempotency_key)
);

create table public.execution_receipts (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null unique
    references public.expenditure_executions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  source_path text,
  source_file_name text not null check (
    char_length(source_file_name) between 1 and 200
  ),
  source_mime_type text not null check (
    source_mime_type in ('application/pdf', 'image/jpeg', 'image/png')
  ),
  source_size_bytes bigint not null check (source_size_bytes > 0),
  source_page_count integer not null check (
    source_page_count between 1 and 30
  ),
  source_fingerprint text not null check (
    source_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  created_at timestamptz not null default now(),
  unique (organization_id, source_fingerprint)
);

create table public.receipt_ocr_runs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.expenditure_executions(id) on delete cascade,
  provider text not null check (provider = 'upstage'),
  api_version text not null,
  model_version text not null,
  page_count integer not null check (page_count between 1 and 30),
  processed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.receipt_verification_results (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.expenditure_executions(id) on delete cascade,
  code text not null,
  version integer not null check (version > 0),
  outcome text not null check (outcome in ('passed', 'warning', 'blocked')),
  message text not null check (char_length(message) between 1 and 500),
  evidence text not null default '' check (char_length(evidence) <= 500),
  created_at timestamptz not null default now(),
  unique (execution_id, code)
);

create index expenditure_executions_organization_id_idx
  on public.expenditure_executions(organization_id);
create index expenditure_executions_plan_item_id_idx
  on public.expenditure_executions(plan_item_id);
create index expenditure_executions_status_idx
  on public.expenditure_executions(status);
create unique index expenditure_executions_semantic_key_idx
  on public.expenditure_executions(organization_id, semantic_key)
  where semantic_key is not null;
create index receipt_ocr_runs_execution_id_idx
  on public.receipt_ocr_runs(execution_id);
create index receipt_verification_results_execution_id_idx
  on public.receipt_verification_results(execution_id);

alter table public.expenditure_executions enable row level security;
alter table public.execution_receipts enable row level security;
alter table public.receipt_ocr_runs enable row level security;
alter table public.receipt_verification_results enable row level security;

grant select on public.expenditure_executions to authenticated;
grant select on public.execution_receipts to authenticated;
grant select on public.receipt_ocr_runs to authenticated;
grant select on public.receipt_verification_results to authenticated;
grant select, insert, update, delete on public.expenditure_executions to service_role;
grant select, insert, update, delete on public.execution_receipts to service_role;
grant select, insert, update, delete on public.receipt_ocr_runs to service_role;
grant select, insert, update, delete on public.receipt_verification_results to service_role;

create policy "Organization members can read executions"
on public.expenditure_executions for select to authenticated
using (private.is_organization_member(organization_id));

create policy "Organization members can read execution receipts"
on public.execution_receipts for select to authenticated
using (private.is_organization_member(organization_id));

create policy "Organization members can read receipt OCR runs"
on public.receipt_ocr_runs for select to authenticated
using (
  exists (
    select 1
    from public.expenditure_executions execution
    where execution.id = execution_id
      and private.is_organization_member(execution.organization_id)
  )
);

create policy "Organization members can read receipt verification results"
on public.receipt_verification_results for select to authenticated
using (
  exists (
    select 1
    from public.expenditure_executions execution
    where execution.id = execution_id
      and private.is_organization_member(execution.organization_id)
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
  'receipt-documents',
  'receipt-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Organization members can read receipt documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipt-documents'
  and private.can_access_receipt_document(name)
);

create or replace function public.create_expenditure_execution_analysis(
  p_actor_id uuid,
  p_organization_id uuid,
  p_donation_id uuid,
  p_plan_id uuid,
  p_plan_item_id uuid,
  p_idempotency_key text,
  p_source_file_name text,
  p_source_mime_type text,
  p_source_size_bytes bigint,
  p_source_page_count integer,
  p_source_fingerprint text
)
returns table (
  execution_id uuid,
  execution_status text,
  execution_draft jsonb,
  execution_validation_issues jsonb,
  execution_verification_results jsonb,
  execution_source_path text,
  lease_token uuid,
  should_process boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_execution public.expenditure_executions%rowtype;
  existing_receipt public.execution_receipts%rowtype;
  new_execution_id uuid;
  process_lease_token uuid;
begin
  if not private.is_organization_member_for(p_organization_id, p_actor_id) then
    raise exception 'Execution access denied';
  end if;

  if not exists (
    select 1
    from public.donations donation
    join public.expenditure_plans plan
      on plan.id = p_plan_id
     and plan.organization_id = donation.organization_id
     and plan.donation_id = donation.id
     and plan.status = 'registered'
    join public.expenditure_plan_items item
      on item.id = p_plan_item_id
     and item.plan_id = plan.id
    where donation.id = p_donation_id
      and donation.organization_id = p_organization_id
      and donation.status = 'paid'
  ) then
    raise exception 'Execution references are invalid';
  end if;

  select * into existing_execution
  from public.expenditure_executions execution
  where execution.created_by = p_actor_id
    and execution.idempotency_key = p_idempotency_key
  for update;

  if found then
    select * into existing_receipt
    from public.execution_receipts receipt
    where receipt.execution_id = existing_execution.id;
    if existing_receipt.source_fingerprint <> p_source_fingerprint
      or existing_execution.organization_id <> p_organization_id
      or existing_execution.plan_item_id <> p_plan_item_id then
      raise exception 'Execution idempotency key does not match';
    end if;
    if existing_execution.status = 'analyzing'
      and (
        existing_execution.analysis_lease_expires_at is null
        or existing_execution.analysis_lease_expires_at <= now()
      ) then
      update public.expenditure_executions execution
      set analysis_lease_expires_at = now() + interval '2 minutes',
          analysis_lease_token = gen_random_uuid(),
          updated_at = now()
      where execution.id = existing_execution.id
      returning execution.analysis_lease_token into process_lease_token;
    end if;

    return query select
      existing_execution.id,
      existing_execution.status,
      existing_execution.draft_data,
      existing_execution.validation_issues,
      existing_execution.verification_results,
      existing_receipt.source_path,
      process_lease_token,
      process_lease_token is not null;
    return;
  end if;

  insert into public.expenditure_executions (
    organization_id,
    donation_id,
    plan_id,
    plan_item_id,
    created_by,
    idempotency_key,
    analysis_lease_expires_at,
    analysis_lease_token
  ) values (
    p_organization_id,
    p_donation_id,
    p_plan_id,
    p_plan_item_id,
    p_actor_id,
    p_idempotency_key,
    now() + interval '2 minutes',
    gen_random_uuid()
  ) returning id, analysis_lease_token
    into new_execution_id, process_lease_token;

  insert into public.execution_receipts (
    execution_id,
    organization_id,
    source_file_name,
    source_mime_type,
    source_size_bytes,
    source_page_count,
    source_fingerprint
  ) values (
    new_execution_id,
    p_organization_id,
    p_source_file_name,
    p_source_mime_type,
    p_source_size_bytes,
    p_source_page_count,
    p_source_fingerprint
  );

  return query select
    new_execution_id,
    'analyzing'::text,
    null::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    null::text,
    process_lease_token,
    true;
end;
$$;

create or replace function public.mark_execution_source_uploaded(
  p_actor_id uuid,
  p_execution_id uuid,
  p_source_path text,
  p_lease_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.execution_receipts receipt
  set source_path = p_source_path
  from public.expenditure_executions execution
  where receipt.execution_id = p_execution_id
    and execution.id = receipt.execution_id
    and execution.status = 'analyzing'
    and execution.analysis_lease_token = p_lease_token
    and private.is_organization_member_for(execution.organization_id, p_actor_id)
    and p_source_path like
      execution.organization_id::text || '/' || execution.id::text || '/source.%';

  if not found then
    raise exception 'Execution is not available for source recording';
  end if;
end;
$$;

create or replace function public.save_expenditure_execution_analysis(
  p_actor_id uuid,
  p_execution_id uuid,
  p_lease_token uuid,
  p_source_path text,
  p_draft jsonb,
  p_validation_issues jsonb,
  p_ocr_metadata jsonb,
  p_verification_results jsonb,
  p_semantic_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
begin
  if exists (
    select 1
    from jsonb_array_elements(p_verification_results) item
    where item->>'outcome' in ('warning', 'blocked')
  ) or jsonb_array_length(p_validation_issues) > 0 then
    next_status := 'verification_warning';
  else
    next_status := 'review_required';
  end if;

  update public.expenditure_executions execution
  set status = next_status,
      ocr_draft_data = p_draft,
      draft_data = p_draft,
      validation_issues = p_validation_issues,
      verification_results = p_verification_results,
      semantic_key = nullif(p_semantic_key, ''),
      analysis_error_code = null,
      analysis_lease_expires_at = null,
      analysis_lease_token = null,
      updated_at = now()
  where execution.id = p_execution_id
    and execution.status = 'analyzing'
    and execution.analysis_lease_token = p_lease_token
    and private.is_organization_member_for(execution.organization_id, p_actor_id);

  if not found then
    raise exception 'Execution analysis is not writable';
  end if;

  update public.execution_receipts receipt
  set source_path = p_source_path
  where receipt.execution_id = p_execution_id;

  insert into public.receipt_ocr_runs (
    execution_id,
    provider,
    api_version,
    model_version,
    page_count,
    processed_at
  ) values (
    p_execution_id,
    'upstage',
    p_ocr_metadata->>'apiVersion',
    p_ocr_metadata->>'modelVersion',
    (p_ocr_metadata->>'pageCount')::integer,
    (p_ocr_metadata->>'processedAt')::timestamptz
  );

  delete from public.receipt_verification_results
  where execution_id = p_execution_id;
  insert into public.receipt_verification_results (
    execution_id,
    code,
    version,
    outcome,
    message,
    evidence
  )
  select
    p_execution_id,
    item->>'code',
    (item->>'version')::integer,
    item->>'outcome',
    item->>'message',
    coalesce(item->>'evidence', '')
  from jsonb_array_elements(p_verification_results) item;

  return next_status;
end;
$$;

create or replace function public.mark_expenditure_execution_failed(
  p_actor_id uuid,
  p_execution_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_source_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.expenditure_executions execution
  set status = 'analysis_failed',
      analysis_error_code = left(p_error_code, 100),
      analysis_lease_expires_at = null,
      analysis_lease_token = null,
      updated_at = now()
  where execution.id = p_execution_id
    and execution.status = 'analyzing'
    and execution.analysis_lease_token = p_lease_token
    and private.is_organization_member_for(execution.organization_id, p_actor_id);

  if not found then
    raise exception 'Execution analysis failure is not writable';
  end if;

  if p_source_path is not null then
    update public.execution_receipts
    set source_path = p_source_path
    where execution_id = p_execution_id;
  end if;
end;
$$;

create or replace function public.claim_execution_analysis_retry(
  p_actor_id uuid,
  p_execution_id uuid
)
returns table (
  execution_id uuid,
  organization_id uuid,
  donation_id uuid,
  plan_id uuid,
  plan_item_id uuid,
  source_path text,
  source_file_name text,
  source_mime_type text,
  source_fingerprint text,
  lease_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.expenditure_executions execution
  set status = 'analyzing',
      analysis_error_code = null,
      analysis_lease_expires_at = now() + interval '2 minutes',
      analysis_lease_token = gen_random_uuid(),
      updated_at = now()
  from public.execution_receipts receipt
  where execution.id = p_execution_id
    and receipt.execution_id = execution.id
    and (
      execution.status = 'analysis_failed'
      or (
        execution.status = 'analyzing'
        and (
          execution.analysis_lease_expires_at is null
          or execution.analysis_lease_expires_at <= now()
        )
      )
    )
    and receipt.source_path is not null
    and private.is_organization_member_for(execution.organization_id, p_actor_id)
  returning
    execution.id,
    execution.organization_id,
    execution.donation_id,
    execution.plan_id,
    execution.plan_item_id,
    receipt.source_path,
    receipt.source_file_name,
    receipt.source_mime_type,
    receipt.source_fingerprint,
    execution.analysis_lease_token;
end;
$$;

create or replace function public.register_expenditure_execution(
  p_actor_id uuid,
  p_execution_id uuid,
  p_draft jsonb,
  p_verification_results jsonb,
  p_warning_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_execution public.expenditure_executions%rowtype;
  current_item public.expenditure_plan_items%rowtype;
  current_plan public.expenditure_plans%rowtype;
  spent_amount bigint;
  requested_amount bigint;
  item_total bigint;
  transaction_time timestamp;
  final_semantic_key text;
begin
  select * into current_execution
  from public.expenditure_executions execution
  where execution.id = p_execution_id
    and private.is_organization_member_for(execution.organization_id, p_actor_id)
  for update;

  if not found then raise exception 'Execution not found'; end if;
  if current_execution.status = 'registered' then return; end if;
  if current_execution.status not in ('review_required', 'verification_warning') then
    raise exception 'Execution is not available for registration';
  end if;

  select * into current_item
  from public.expenditure_plan_items item
  where item.id = current_execution.plan_item_id
    and item.plan_id = current_execution.plan_id
  for update;
  select * into current_plan
  from public.expenditure_plans plan
  where plan.id = current_execution.plan_id
    and plan.status = 'registered'
    and plan.organization_id = current_execution.organization_id
    and plan.donation_id = current_execution.donation_id;
  if current_item.id is null or current_plan.id is null then
    raise exception 'Execution references are invalid';
  end if;

  if coalesce(trim(p_draft->>'merchantName'), '') = ''
    or char_length(trim(p_draft->>'merchantName')) > 200
    or coalesce(p_draft->>'transactionAt', '') = '' then
    raise exception 'Required receipt fields are missing';
  end if;
  if char_length(coalesce(p_draft->>'paymentMethod', '')) > 100
    or char_length(coalesce(p_draft->>'approvalNumber', '')) > 40 then
    raise exception 'Receipt text fields are too long';
  end if;

  requested_amount := (p_draft->>'totalAmount')::bigint;
  transaction_time := (p_draft->>'transactionAt')::timestamp;
  final_semantic_key := case
    when coalesce(trim(p_draft->>'businessNumber'), '') = '' then null
    else concat(
      trim(p_draft->>'businessNumber'), ':',
      to_char(transaction_time, 'YYYY-MM-DD"T"HH24:MI'), ':',
      requested_amount::text, ':',
      coalesce(nullif(trim(p_draft->>'approvalNumber'), ''), 'no-approval')
    )
  end;
  if requested_amount not between 1 and 1000000000000 then
    raise exception 'Receipt amount is invalid';
  end if;
  if transaction_time::date < current_plan.period_start
    or transaction_time::date > current_plan.period_end then
    raise exception 'Receipt date is outside plan period';
  end if;

  if p_draft->>'supplyAmount' is not null
    and p_draft->>'taxAmount' is not null
    and (p_draft->>'supplyAmount')::bigint + (p_draft->>'taxAmount')::bigint
      <> requested_amount then
    raise exception 'Receipt arithmetic does not match';
  end if;

  if jsonb_array_length(coalesce(p_draft->'items', '[]'::jsonb)) > 0 then
    select coalesce(sum((item->>'amount')::bigint), 0)
    into item_total
    from jsonb_array_elements(p_draft->'items') item;
    if item_total <> requested_amount then
      raise exception 'Receipt item total does not match';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_verification_results) item
    where item->>'outcome' = 'blocked'
  ) then
    raise exception 'Blocked receipt cannot be registered';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_verification_results) item
    where item->>'outcome' = 'warning'
  ) and coalesce(trim(p_warning_reason), '') = '' then
    raise exception 'Warning acknowledgement is required';
  end if;

  select coalesce(sum(execution.total_amount), 0)
  into spent_amount
  from public.expenditure_executions execution
  where execution.plan_item_id = current_item.id
    and execution.status = 'registered'
    and execution.id <> p_execution_id;
  if spent_amount + requested_amount > current_item.amount then
    raise exception 'Remaining budget exceeded';
  end if;

  update public.expenditure_executions
  set merchant_name = trim(p_draft->>'merchantName'),
      business_number = nullif(p_draft->>'businessNumber', ''),
      transaction_at = transaction_time,
      supply_amount = nullif(p_draft->>'supplyAmount', '')::bigint,
      tax_amount = nullif(p_draft->>'taxAmount', '')::bigint,
      total_amount = requested_amount,
      payment_method = coalesce(p_draft->>'paymentMethod', ''),
      approval_number = coalesce(p_draft->>'approvalNumber', ''),
      semantic_key = final_semantic_key,
      draft_data = p_draft,
      validation_issues = '[]'::jsonb,
      verification_results = p_verification_results,
      warning_reason = trim(coalesce(p_warning_reason, '')),
      status = 'registered',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      updated_at = now()
  where id = p_execution_id;

  delete from public.receipt_verification_results
  where execution_id = p_execution_id;
  insert into public.receipt_verification_results (
    execution_id, code, version, outcome, message, evidence
  )
  select
    p_execution_id,
    item->>'code',
    (item->>'version')::integer,
    item->>'outcome',
    item->>'message',
    coalesce(item->>'evidence', '')
  from jsonb_array_elements(p_verification_results) item;
end;
$$;

revoke all on function private.can_access_receipt_document(text) from public;
grant execute on function private.can_access_receipt_document(text) to authenticated;
revoke all on function public.create_expenditure_execution_analysis(
  uuid, uuid, uuid, uuid, uuid, text, text, text, bigint, integer, text
) from public;
revoke all on function public.mark_execution_source_uploaded(
  uuid, uuid, text, uuid
) from public;
revoke all on function public.save_expenditure_execution_analysis(
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, text
) from public;
revoke all on function public.mark_expenditure_execution_failed(
  uuid, uuid, uuid, text, text
) from public;
revoke all on function public.claim_execution_analysis_retry(
  uuid, uuid
) from public;
revoke all on function public.register_expenditure_execution(
  uuid, uuid, jsonb, jsonb, text
) from public;

grant execute on function public.create_expenditure_execution_analysis(
  uuid, uuid, uuid, uuid, uuid, text, text, text, bigint, integer, text
) to service_role;
grant execute on function public.mark_execution_source_uploaded(
  uuid, uuid, text, uuid
) to service_role;
grant execute on function public.save_expenditure_execution_analysis(
  uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, text
) to service_role;
grant execute on function public.mark_expenditure_execution_failed(
  uuid, uuid, uuid, text, text
) to service_role;
grant execute on function public.claim_execution_analysis_retry(
  uuid, uuid
) to service_role;
grant execute on function public.register_expenditure_execution(
  uuid, uuid, jsonb, jsonb, text
) to service_role;
