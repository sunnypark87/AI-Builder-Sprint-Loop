alter table public.modusign_webhook_events
  add column if not exists processing_started_at timestamptz;

create or replace function public.claim_modusign_webhook_event(
  p_provider_event_id text,
  p_provider_document_id text,
  p_event_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_event public.modusign_webhook_events%rowtype;
begin
  insert into public.modusign_webhook_events (
    event_type,
    provider_document_id,
    provider_event_id
  ) values (
    p_event_type,
    p_provider_document_id,
    p_provider_event_id
  ) on conflict (provider_event_id) do nothing;

  select *
    into current_event
    from public.modusign_webhook_events
   where provider_event_id = p_provider_event_id
   for update;

  if current_event.processed_at is not null then
    return 'processed';
  end if;

  if current_event.processing_started_at is not null
     and current_event.processing_started_at > now() - interval '5 minutes' then
    return 'in_progress';
  end if;

  update public.modusign_webhook_events
     set processing_started_at = now(),
         processing_error_code = null
   where id = current_event.id;

  return 'claimed';
end;
$$;

revoke all on function public.claim_modusign_webhook_event(text, text, text) from public;
grant execute on function public.claim_modusign_webhook_event(text, text, text) to service_role;
