update public.pledges
set status = 'draft'
where status = 'preparing_signature';

alter table public.pledges drop constraint if exists pledges_status_check;

alter table public.pledges add constraint pledges_status_check check (
  status in (
    'draft',
    'awaiting_donor_signature',
    'awaiting_organization_signature',
    'signed',
    'declined',
    'cancelled',
    'expired'
  )
);
