-- Run after profile-view.sql and account-setup.sql.
begin;
create table if not exists public.profile_decisions (
  actor_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('like', 'pass')),
  updated_at timestamptz not null default now(),
  primary key(actor_id, target_id),
  check (actor_id <> target_id)
);
create table if not exists public.matches (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_a, user_b),
  check (user_a < user_b)
);
alter table public.profile_decisions enable row level security;
alter table public.matches enable row level security;
revoke all on public.profile_decisions, public.matches from anon, authenticated;

create or replace function public.profile_match_status(target_profile uuid)
returns table (decision text, matched boolean)
language sql stable security definer set search_path = '' as $$
  select (select d.decision from public.profile_decisions d
    where d.actor_id = auth.uid() and d.target_id = u.auth_user_id),
    exists(select 1 from public.matches m
      where m.user_a = least(auth.uid(), u.auth_user_id)
        and m.user_b = greatest(auth.uid(), u.auth_user_id))
  from public.users u where u.id = target_profile and auth.uid() is not null;
$$;

create or replace function public.decide_profile(target_profile uuid, chosen_decision text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  target_user uuid;
  first_user uuid;
  second_user uuid;
  mutual boolean;
begin
  if not public.photo_setup_complete() then
    raise exception 'Finish your registration before liking or passing on profiles.';
  end if;
  if chosen_decision is null or chosen_decision not in ('like', 'pass') then
    raise exception 'Invalid decision.';
  end if;
  select u.auth_user_id into target_user from public.users u where u.id = target_profile;
  if target_user is null or target_user = auth.uid() or not public.profile_is_visible(target_user) then
    raise exception 'This profile is unavailable.';
  end if;
  first_user := least(auth.uid(), target_user);
  second_user := greatest(auth.uid(), target_user);
  -- Serialize decisions for this pair so simultaneous likes create one match.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(first_user::text || second_user::text, 0));
  insert into public.profile_decisions(actor_id, target_id, decision)
    values (auth.uid(), target_user, chosen_decision)
    on conflict (actor_id, target_id) do update set decision = excluded.decision, updated_at = now();
  mutual := chosen_decision = 'like' and exists (
    select 1 from public.profile_decisions d
    where d.actor_id = target_user and d.target_id = auth.uid() and d.decision = 'like'
  );
  if mutual then
    insert into public.matches(user_a, user_b) values (first_user, second_user)
    on conflict do nothing;
  else
    delete from public.matches where user_a = first_user and user_b = second_user;
  end if;
  return mutual;
end;
$$;
revoke all on function public.profile_match_status(uuid) from public, anon;
revoke all on function public.decide_profile(uuid, text) from public, anon;
grant execute on function public.profile_match_status(uuid), public.decide_profile(uuid, text) to authenticated;
commit;
