alter table public.pledge_chat_messages
  add column if not exists status text not null default 'completed',
  add column if not exists client_request_id uuid,
  add column if not exists reply_to_message_id uuid references public.pledge_chat_messages(id) on delete set null,
  add column if not exists failure_code text,
  add column if not exists failure_retryable boolean,
  add column if not exists updated_at timestamptz not null default now();

alter table public.pledge_chat_messages
  drop constraint if exists pledge_chat_messages_status_check;

alter table public.pledge_chat_messages
  add constraint pledge_chat_messages_status_check
  check (status in ('pending', 'completed', 'failed'));

alter table public.pledge_chat_messages
  add constraint pledge_chat_messages_failure_state_check
  check (
    (status = 'failed' and failure_code is not null and failure_retryable is not null)
    or (status <> 'failed' and failure_code is null and failure_retryable is null)
  );

alter table public.pledge_chat_messages
  add constraint pledge_chat_messages_failure_code_check
  check (
    failure_code is null or failure_code in (
      'configuration_error', 'authentication_failed', 'rate_limited',
      'request_timeout', 'network_error', 'upstream_unavailable',
      'invalid_request', 'invalid_response', 'empty_response',
      'schema_validation_failed', 'grounding_failed',
      'consultation_state_changed', 'consultation_storage_failed'
    )
  );

create unique index if not exists pledge_chat_messages_request_id_idx
  on public.pledge_chat_messages (pledge_id, client_request_id)
  where role = 'user' and client_request_id is not null;

create unique index if not exists pledge_chat_messages_reply_to_idx
  on public.pledge_chat_messages (reply_to_message_id)
  where role = 'assistant' and reply_to_message_id is not null;

drop policy if exists pledge_chat_messages_donor_insert on public.pledge_chat_messages;

create policy pledge_chat_messages_donor_insert on public.pledge_chat_messages
  for insert with check (
    role = 'user' and status = 'pending' and exists (
      select 1 from public.pledges pledge
      where pledge.id = pledge_chat_messages.pledge_id
        and pledge.donor_user_id = auth.uid()
        and pledge.status = 'draft'
    )
  );

create table if not exists public.pledge_ai_proposals (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null references public.pledges(id) on delete cascade,
  assistant_message_id uuid not null unique references public.pledge_chat_messages(id) on delete cascade,
  proposed_patch jsonb not null,
  reviewed_patch jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'superseded')),
  confirmation_fields text[] not null default '{}',
  conflict_fields text[] not null default '{}',
  missing_fields text[] not null default '{}',
  next_question_field text,
  pledge_version integer not null check (pledge_version > 0),
  model text not null,
  provider_request_id text,
  attempt_count integer not null check (attempt_count between 1 and 2),
  duration_ms integer not null check (duration_ms >= 0),
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists pledge_ai_proposals_pledge_status_idx
  on public.pledge_ai_proposals (pledge_id, status, created_at desc);

alter table public.pledge_ai_proposals enable row level security;

create policy pledge_ai_proposals_donor_read on public.pledge_ai_proposals
  for select using (exists (
    select 1 from public.pledges pledge
    where pledge.id = pledge_ai_proposals.pledge_id
      and pledge.donor_user_id = auth.uid()
  ));

revoke insert, update, delete on public.pledge_ai_proposals from anon, authenticated;

create or replace function public.complete_pledge_ai_consultation(
  p_user_message_id uuid,
  p_assistant_content text,
  p_proposed_patch jsonb,
  p_confirmation_fields text[],
  p_conflict_fields text[],
  p_missing_fields text[],
  p_next_question_field text,
  p_pledge_version integer,
  p_model text,
  p_provider_request_id text,
  p_attempt_count integer,
  p_duration_ms integer,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_total_tokens integer,
  p_prompt_version text
) returns table (assistant_message_id uuid, proposal_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pledge_id uuid;
begin
  select message.pledge_id into target_pledge_id
  from public.pledge_chat_messages message
  join public.pledges pledge on pledge.id = message.pledge_id
  where message.id = p_user_message_id
    and message.role = 'user'
    and message.status = 'pending'
    and pledge.donor_user_id = auth.uid()
    and pledge.status = 'draft'
    and pledge.version = p_pledge_version
  for update of message;

  if target_pledge_id is null then
    raise exception using errcode = 'P0001', message = 'consultation_turn_not_available';
  end if;

  insert into public.pledge_chat_messages (
    pledge_id, role, content, reply_to_message_id, status
  ) values (
    target_pledge_id, 'assistant', p_assistant_content, p_user_message_id, 'completed'
  ) returning id into assistant_message_id;

  insert into public.pledge_ai_proposals (
    pledge_id, assistant_message_id, proposed_patch, confirmation_fields,
    conflict_fields, missing_fields, next_question_field, pledge_version,
    model, provider_request_id, attempt_count, duration_ms, prompt_tokens,
    completion_tokens, total_tokens, prompt_version
  ) values (
    target_pledge_id, assistant_message_id, p_proposed_patch,
    p_confirmation_fields, p_conflict_fields, p_missing_fields,
    p_next_question_field, p_pledge_version, p_model, p_provider_request_id,
    p_attempt_count, p_duration_ms, p_prompt_tokens, p_completion_tokens,
    p_total_tokens, p_prompt_version
  ) returning id into proposal_id;

  update public.pledge_chat_messages
  set status = 'completed', failure_code = null, failure_retryable = null, updated_at = now()
  where id = p_user_message_id;

  return next;
end;
$$;

create or replace function public.fail_pledge_ai_consultation(
  p_user_message_id uuid,
  p_failure_code text,
  p_failure_retryable boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pledge_chat_messages message
  set status = 'failed',
      failure_code = p_failure_code,
      failure_retryable = p_failure_retryable,
      updated_at = now()
  from public.pledges pledge
  where message.id = p_user_message_id
    and message.role = 'user'
    and message.status = 'pending'
    and pledge.id = message.pledge_id
    and pledge.donor_user_id = auth.uid()
    and not exists (
      select 1 from public.pledge_chat_messages assistant
      where assistant.reply_to_message_id = message.id
    );

  if not found then
    raise exception using errcode = 'P0001', message = 'consultation_turn_not_available';
  end if;
end;
$$;

create or replace function public.retry_pledge_ai_consultation(
  p_user_message_id uuid
) returns table (id uuid, pledge_id uuid, client_request_id uuid, content text, status text, failure_code text, failure_retryable boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.pledge_chat_messages message
  set status = 'pending',
      failure_code = null,
      failure_retryable = null,
      updated_at = now()
  from public.pledges pledge
  where message.id = p_user_message_id
    and message.role = 'user'
    and message.status = 'failed'
    and message.failure_retryable = true
    and pledge.id = message.pledge_id
    and pledge.donor_user_id = auth.uid()
    and pledge.status = 'draft'
  returning message.id, message.pledge_id, message.client_request_id,
    message.content, message.status, message.failure_code,
    message.failure_retryable;

  if not found then
    raise exception using errcode = 'P0001', message = 'consultation_turn_not_available';
  end if;
end;
$$;

create or replace function public.recover_stale_pledge_ai_consultation(
  p_user_message_id uuid,
  p_stale_before timestamptz
) returns table (id uuid, pledge_id uuid, client_request_id uuid, content text, status text, failure_code text, failure_retryable boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.pledge_chat_messages message
  set updated_at = now()
  from public.pledges pledge
  where message.id = p_user_message_id
    and message.role = 'user'
    and message.status = 'pending'
    and message.updated_at < p_stale_before
    and not exists (
      select 1 from public.pledge_chat_messages assistant
      where assistant.reply_to_message_id = message.id
    )
    and pledge.id = message.pledge_id
    and pledge.donor_user_id = auth.uid()
    and pledge.status = 'draft'
  returning message.id, message.pledge_id, message.client_request_id,
    message.content, message.status, message.failure_code,
    message.failure_retryable, message.updated_at;

  if not found then
    raise exception using errcode = 'P0001', message = 'consultation_turn_not_available';
  end if;
end;
$$;

revoke all on function public.complete_pledge_ai_consultation(
  uuid, text, jsonb, text[], text[], text[], text, integer, text, text,
  integer, integer, integer, integer, integer, text
) from public;
grant execute on function public.complete_pledge_ai_consultation(
  uuid, text, jsonb, text[], text[], text[], text, integer, text, text,
  integer, integer, integer, integer, integer, text
) to authenticated;
revoke all on function public.fail_pledge_ai_consultation(uuid, text, boolean) from public;
grant execute on function public.fail_pledge_ai_consultation(uuid, text, boolean) to authenticated;
revoke all on function public.retry_pledge_ai_consultation(uuid) from public;
grant execute on function public.retry_pledge_ai_consultation(uuid) to authenticated;
revoke all on function public.recover_stale_pledge_ai_consultation(uuid, timestamptz) from public;
grant execute on function public.recover_stale_pledge_ai_consultation(uuid, timestamptz) to authenticated;
