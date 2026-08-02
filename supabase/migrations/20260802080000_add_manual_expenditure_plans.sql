alter table public.expenditure_plans
  add column if not exists input_method text;

update public.expenditure_plans
set input_method = 'ocr'
where input_method is null;

alter table public.expenditure_plans
  alter column input_method set default 'ocr',
  alter column input_method set not null,
  alter column source_file_name drop not null,
  alter column source_mime_type drop not null,
  alter column source_size_bytes drop not null,
  alter column source_page_count drop not null,
  alter column source_fingerprint drop not null;

alter table public.expenditure_plans
  drop constraint if exists expenditure_plans_input_method_check,
  add constraint expenditure_plans_input_method_check
  check (
    (
      input_method = 'ocr'
      and source_file_name is not null
      and source_mime_type is not null
      and source_size_bytes is not null
      and source_page_count is not null
      and source_fingerprint is not null
    )
    or (
      input_method = 'manual'
      and source_path is null
      and source_file_name is null
      and source_mime_type is null
      and source_size_bytes is null
      and source_page_count is null
      and source_fingerprint is null
      and ocr_metadata is null
    )
  );

create or replace function public.create_manual_expenditure_plan(
  p_actor_id uuid,
  p_organization_id uuid,
  p_donation_id uuid,
  p_idempotency_key text,
  p_draft jsonb
)
returns table (
  plan_id uuid,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_plan_id uuid;
  target_status text;
  target_input_method text;
  target_organization_id uuid;
  target_donation_id uuid;
  target_draft jsonb;
  inserted boolean := false;
begin
  if p_actor_id is null
    or coalesce(trim(p_idempotency_key), '') = ''
    or char_length(p_idempotency_key) > 200
    or not private.is_organization_member_for(p_organization_id, p_actor_id)
    or not exists (
      select 1
      from public.donations donation
      where donation.id = p_donation_id
        and donation.organization_id = p_organization_id
        and donation.status = 'paid'
    ) then
    raise exception 'Manual plan creation is not allowed';
  end if;

  insert into public.expenditure_plans (
    organization_id,
    donation_id,
    created_by,
    status,
    input_method,
    draft_data,
    validation_issues,
    idempotency_key
  )
  values (
    p_organization_id,
    p_donation_id,
    p_actor_id,
    'review_required',
    'manual',
    p_draft,
    '[]'::jsonb,
    p_idempotency_key
  )
  on conflict (created_by, idempotency_key) do nothing
  returning id into target_plan_id;

  inserted := target_plan_id is not null;

  if target_plan_id is null then
    select
      plan.id,
      plan.status,
      plan.input_method,
      plan.organization_id,
      plan.donation_id,
      plan.draft_data
    into
      target_plan_id,
      target_status,
      target_input_method,
      target_organization_id,
      target_donation_id,
      target_draft
    from public.expenditure_plans plan
    where plan.created_by = p_actor_id
      and plan.idempotency_key = p_idempotency_key
    for update;

    if target_plan_id is null
      or target_input_method is distinct from 'manual'
      or target_organization_id is distinct from p_organization_id
      or target_donation_id is distinct from p_donation_id
      or target_draft is distinct from p_draft
      or target_status not in ('review_required', 'registered') then
      raise exception 'Plan idempotency key does not match manual draft';
    end if;
  end if;

  if inserted then
    target_status := 'review_required';
  end if;

  if target_status = 'review_required' then
    perform public.register_expenditure_plan(
      p_actor_id,
      target_plan_id,
      p_draft
    );
  end if;

  return query select target_plan_id, inserted;
end;
$$;

revoke all on function public.create_manual_expenditure_plan(uuid, uuid, uuid, text, jsonb)
  from public;
grant execute on function public.create_manual_expenditure_plan(uuid, uuid, uuid, text, jsonb)
  to service_role;
