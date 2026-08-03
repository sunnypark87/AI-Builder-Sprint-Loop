alter table public.pledges
  alter column purpose drop not null;

alter table public.pledges
  alter column donation_type drop not null;
