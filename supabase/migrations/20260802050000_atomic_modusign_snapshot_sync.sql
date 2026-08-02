create or replace function public.apply_modusign_snapshot(
  p_signature_document_id uuid,
  p_provider_document_id text,
  p_provider_status text,
  p_next_pledge_status text,
  p_participants jsonb,
  p_provider_event_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pledge_id uuid;
  current_pledge_status text;
begin
  select pledge_id
    into target_pledge_id
    from public.signature_documents
   where id = p_signature_document_id
     and provider_document_id = p_provider_document_id
   for update;

  if target_pledge_id is null then
    raise exception 'signature_document_not_found';
  end if;

  select status
    into current_pledge_status
    from public.pledges
   where id = target_pledge_id
   for update;

  if current_pledge_status is null then
    raise exception 'pledge_not_found';
  end if;

  if current_pledge_status <> p_next_pledge_status and not (
    (current_pledge_status = 'draft' and p_next_pledge_status = 'awaiting_donor_signature') or
    (current_pledge_status = 'awaiting_donor_signature' and p_next_pledge_status in ('awaiting_organization_signature', 'signed', 'declined', 'cancelled', 'expired')) or
    (current_pledge_status = 'awaiting_organization_signature' and p_next_pledge_status in ('signed', 'declined', 'cancelled', 'expired'))
  ) then
    raise exception 'invalid_provider_transition';
  end if;

  insert into public.signature_participants (
    provider_participant_id,
    role,
    signature_document_id,
    signing_order,
    status,
    signed_at
  )
  select
    participant.provider_participant_id,
    participant.role,
    p_signature_document_id,
    participant.signing_order,
    participant.status,
    participant.signed_at
  from jsonb_to_recordset(p_participants) as participant(
    provider_participant_id text,
    role text,
    signing_order integer,
    status text,
    signed_at timestamptz
  )
  on conflict (signature_document_id, role) do update
    set provider_participant_id = excluded.provider_participant_id,
        signing_order = excluded.signing_order,
        status = case
          when signature_participants.status = 'signed' then 'signed'
          else excluded.status
        end,
        signed_at = case
          when signature_participants.status = 'signed' then signature_participants.signed_at
          else excluded.signed_at
        end,
        updated_at = now();

  update public.signature_documents
     set provider_status = p_provider_status,
         sync_status = 'idle',
         last_error_code = null,
         last_synced_at = now(),
         updated_at = now()
   where id = p_signature_document_id
     and provider_document_id = p_provider_document_id;

  update public.pledges
     set status = p_next_pledge_status,
         updated_at = now()
   where id = target_pledge_id;

  if p_provider_event_id is not null then
    update public.modusign_webhook_events
       set processed_at = now(),
           processing_started_at = null,
           processing_error_code = null
     where provider_event_id = p_provider_event_id;

    if not found then
      raise exception 'webhook_event_not_found';
    end if;
  end if;
end;
$$;

revoke all on function public.apply_modusign_snapshot(uuid, text, text, text, jsonb, text) from public;
grant execute on function public.apply_modusign_snapshot(uuid, text, text, text, jsonb, text) to service_role;
