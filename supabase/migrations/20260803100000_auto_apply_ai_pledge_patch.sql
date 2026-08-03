-- AI 상담에서 추출한 유효한 약정 필드를 사용자 승인 없이 초안에 반영한다.
-- pledge_ai_proposals는 기존 감사/이력 호환을 위해 accepted 상태로만 기록한다.
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
  patch jsonb := coalesce(p_proposed_patch, '{}'::jsonb);
  next_version integer;
begin
  if jsonb_typeof(patch) <> 'object' then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_patch';
  end if;

  if patch ? 'amount' and (
    jsonb_typeof(patch->'amount') <> 'number' or
    (patch->>'amount')::numeric <= 0 or
    (patch->>'amount')::numeric > 10000000000
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_patch';
  end if;
  if patch ? 'donationDesignation' and
    patch->>'donationDesignation' not in ('designated', 'undesignated') then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_patch';
  end if;
  if patch ? 'paymentSchedule' and
    patch->>'paymentSchedule' not in ('lump_sum', 'other') then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_patch';
  end if;
  if patch ? 'paymentMethod' and
    patch->>'paymentMethod' not in ('online', 'direct', 'other') then
    raise exception using errcode = 'P0001', message = 'invalid_proposal_patch';
  end if;
  if patch->>'donationDesignation' = 'undesignated' then
    patch := patch || '{"donationCondition":null}'::jsonb;
  end if;

  select message.pledge_id into target_pledge_id
  from public.pledge_chat_messages message
  join public.pledges pledge on pledge.id = message.pledge_id
  where message.id = p_user_message_id
    and message.role = 'user'
    and message.status = 'pending'
    and pledge.donor_user_id = auth.uid()
    and pledge.status = 'draft'
    and pledge.version = p_pledge_version
  for update of message, pledge;

  if target_pledge_id is null then
    raise exception using errcode = 'P0001', message = 'consultation_turn_not_available';
  end if;

  if patch <> '{}'::jsonb then
    update public.pledges
    set amount = case when patch ? 'amount' then (patch->>'amount')::numeric else amount end,
        donation_designation = case when patch ? 'donationDesignation' then patch->>'donationDesignation' else donation_designation end,
        donation_condition = case when patch ? 'donationCondition' then nullif(patch->>'donationCondition', '') else donation_condition end,
        payment_schedule = case when patch ? 'paymentSchedule' then patch->>'paymentSchedule' else payment_schedule end,
        payment_schedule_other = case when patch ? 'paymentScheduleOther' then nullif(patch->>'paymentScheduleOther', '') else payment_schedule_other end,
        payment_method = case when patch ? 'paymentMethod' then patch->>'paymentMethod' else payment_method end,
        payment_method_other = case when patch ? 'paymentMethodOther' then nullif(patch->>'paymentMethodOther', '') else payment_method_other end,
        version = version + 1,
        updated_at = now()
    where id = target_pledge_id and version = p_pledge_version;
    next_version := p_pledge_version + 1;
  else
    next_version := p_pledge_version;
  end if;

  insert into public.pledge_chat_messages (
    pledge_id, role, content, proposed_patch, reply_to_message_id, status
  ) values (
    target_pledge_id, 'assistant', p_assistant_content, patch,
    p_user_message_id, 'completed'
  ) returning id into assistant_message_id;

  insert into public.pledge_ai_proposals (
    pledge_id, assistant_message_id, proposed_patch, reviewed_patch, status,
    confirmation_fields, conflict_fields, missing_fields, next_question_field,
    pledge_version, model, provider_request_id, attempt_count, duration_ms,
    prompt_tokens, completion_tokens, total_tokens, prompt_version, reviewed_at
  ) values (
    target_pledge_id, assistant_message_id, patch, patch, 'accepted',
    p_confirmation_fields, p_conflict_fields, p_missing_fields,
    p_next_question_field, next_version, p_model, p_provider_request_id,
    p_attempt_count, p_duration_ms, p_prompt_tokens, p_completion_tokens,
    p_total_tokens, p_prompt_version, now()
  ) returning id into proposal_id;

  update public.pledge_chat_messages
  set status = 'completed', failure_code = null, failure_retryable = null, updated_at = now()
  where id = p_user_message_id;

  return next;
end;
$$;

-- 사용자 승인/거절 경로는 자동 작성 흐름에서 더 이상 사용하지 않는다.
revoke execute on function public.review_pledge_ai_proposal(
  uuid, uuid, text, integer
) from authenticated;
