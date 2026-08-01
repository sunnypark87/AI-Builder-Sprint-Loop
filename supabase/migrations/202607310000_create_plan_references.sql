create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'manager', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  amount bigint not null check (amount > 0),
  status text not null default 'paid'
    check (status in ('paid', 'cancelled', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);
create index if not exists donations_organization_id_idx
  on public.donations(organization_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.donations enable row level security;

create policy "Members can read their organizations"
on public.organizations for select to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = id
      and member.user_id = (select auth.uid())
  )
);

create policy "Members can read their own memberships"
on public.organization_members for select to authenticated
using (user_id = (select auth.uid()));

create policy "Members can read organization donations"
on public.donations for select to authenticated
using (
  exists (
    select 1
    from public.organization_members member
    where member.organization_id = donations.organization_id
      and member.user_id = (select auth.uid())
  )
);

grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.donations to authenticated;
grant select, insert, update, delete on public.organizations to service_role;
grant select, insert, update, delete on public.organization_members to service_role;
grant select, insert, update, delete on public.donations to service_role;
