create table if not exists public.pledge_chat_messages (
  id uuid primary key default gen_random_uuid(),
  pledge_id uuid not null references public.pledges(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  proposed_patch jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pledge_chat_messages_pledge_id_created_at_idx
  on public.pledge_chat_messages (pledge_id, created_at);

alter table public.pledge_chat_messages enable row level security;

create policy pledge_chat_messages_donor_read on public.pledge_chat_messages
  for select using (exists (
    select 1 from public.pledges pledge
    where pledge.id = pledge_chat_messages.pledge_id
      and pledge.donor_user_id = auth.uid()
  ));

create policy pledge_chat_messages_donor_insert on public.pledge_chat_messages
  for insert with check (exists (
    select 1 from public.pledges pledge
    where pledge.id = pledge_chat_messages.pledge_id
      and pledge.donor_user_id = auth.uid()
  ));

alter table public.pledges alter column amount drop not null;
alter table public.pledges alter column donation_type drop not null;
alter table public.pledges alter column purpose drop not null;
alter table public.pledges alter column pledge_date drop not null;
alter table public.pledges alter column donor_name drop not null;
alter table public.pledges alter column donor_address drop not null;
alter table public.pledges alter column donor_contact drop not null;
