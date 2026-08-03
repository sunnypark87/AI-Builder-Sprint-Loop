-- The signing schema defined pledge RLS policies without the matching table
-- privileges. Reports need server-side pledge reads, while the existing donor
-- and organization pages need authenticated reads for those policies to run.
grant select on public.pledges to authenticated;
grant select, insert, update, delete on public.pledges to service_role;
