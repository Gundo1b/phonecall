-- Run in Supabase SQL Editor. Stores only the latest position, not history.
begin;
grant usage on schema public to authenticated;
create table if not exists public.user_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision not null check (accuracy >= 0),
  observed_at timestamptz not null
);
alter table public.user_locations enable row level security;
revoke all on public.user_locations from anon, authenticated;
grant select, insert, update on public.user_locations to authenticated;
drop policy if exists "Own location only" on public.user_locations;
create policy "Own location only" on public.user_locations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
commit;
