alter table public.organization_members
  add column if not exists is_primary_signer boolean not null default false;

create unique index if not exists organization_members_one_primary_signer_idx
  on public.organization_members (organization_id)
  where is_primary_signer;
