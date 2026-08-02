create or replace function public.finalize_modusign_signature_request(
  p_signature_document_id uuid,
  p_provider_document_id text,
  p_provider_status text,
  p_donor_participant_id text,
  p_organization_participant_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pledge_id uuid;
begin
  select pledge_id
    into target_pledge_id
    from public.signature_documents
   where id = p_signature_document_id
   for update;

  if target_pledge_id is null then
    raise exception 'signature_document_not_found';
  end if;

  insert into public.signature_participants (
    provider_participant_id,
    role,
    signature_document_id,
    signing_order
  ) values
    (p_donor_participant_id, 'donor', p_signature_document_id, 1),
    (p_organization_participant_id, 'organization', p_signature_document_id, 2)
  on conflict (signature_document_id, role) do update
    set provider_participant_id = excluded.provider_participant_id,
        signing_order = excluded.signing_order,
        updated_at = now();

  update public.signature_documents
     set provider_status = p_provider_status,
         sync_status = 'idle',
         last_error_code = null,
         last_synced_at = now(),
         updated_at = now()
   where id = p_signature_document_id
     and provider_document_id = p_provider_document_id;

  if not found then
    raise exception 'provider_document_link_missing';
  end if;

  update public.pledges
     set status = 'awaiting_donor_signature',
         updated_at = now()
   where id = target_pledge_id
     and status = 'draft';

  if not found then
    raise exception 'pledge_state_changed';
  end if;
end;
$$;

revoke all on function public.finalize_modusign_signature_request(uuid, text, text, text, text) from public;
grant execute on function public.finalize_modusign_signature_request(uuid, text, text, text, text) to service_role;
