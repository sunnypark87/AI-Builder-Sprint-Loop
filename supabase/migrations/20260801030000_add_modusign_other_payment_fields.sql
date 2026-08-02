alter table public.pledges
  add column if not exists payment_schedule_other text,
  add column if not exists payment_method_other text;
