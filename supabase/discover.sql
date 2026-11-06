-- Run after location.sql, contact-signup.sql, and account-setup.sql.
-- Only approximate positions and distances are returned.
begin;
drop function if exists public.discover_people();
drop function if exists public.discover_people(integer, integer, integer, text);
create function public.discover_people(
  max_distance integer default null,
  min_age integer default 18,
  max_age integer default 120,
  preferred_gender text default 'all'
)
returns table (
  profile_id uuid, display_name text, latitude double precision,
  longitude double precision, distance_km integer,
  location_updated_at timestamptz, gender text, age integer, photo_path text
)
language sql stable security definer set search_path = '' as $$
  with me as (
    select round(l.latitude::numeric, 2)::double precision as lat,
      round(l.longitude::numeric, 2)::double precision as lng
    from public.user_locations l where l.user_id = auth.uid()
  ), people as (
    select u.id, u.name, u.auth_user_id, s.gender,
      extract(year from age(current_date, d.birth_date))::integer as years,
      round(l.latitude::numeric, 2)::double precision as lat,
      round(l.longitude::numeric, 2)::double precision as lng, l.observed_at
    from public.users u
    join public.user_locations l on l.user_id = u.auth_user_id
    join public.account_setup s on s.user_id = u.auth_user_id
    join public.signup_details d on d.user_id = u.auth_user_id
    join auth.users a on a.id = u.auth_user_id
    where auth.uid() is not null and u.auth_user_id <> auth.uid()
      and a.email is not null and a.email <> '' and a.email_confirmed_at is not null
      and a.encrypted_password is not null and a.encrypted_password <> ''
  ), measured as (
    select p.*, case when me.lat is null then null else
      6371 * 2 * asin(sqrt(least(1.0,
        power(sin(radians(p.lat - me.lat) / 2), 2) +
        cos(radians(me.lat)) * cos(radians(p.lat)) *
        power(sin(radians(p.lng - me.lng) / 2), 2)
      ))) end as km
    from people p left join me on true
  )
  select p.id, coalesce(nullif(trim(p.name), ''), 'Member'), p.lat, p.lng,
    round(p.km::numeric)::integer, p.observed_at, p.gender, p.years,
    (select o.name from storage.objects o
      where o.bucket_id = 'profile-photos'
        and o.name ~ ('^' || p.auth_user_id::text || '/[1-7]$')
      order by o.name limit 1)
  from measured p
  where min_age >= 18 and max_age <= 120 and min_age <= max_age
    and p.years between min_age and max_age
    and (preferred_gender = 'all' or p.gender = preferred_gender)
    and (max_distance is null or (max_distance between 1 and 1000 and p.km <= max_distance))
  order by p.km nulls last, p.id
  limit 200;
$$;
revoke all on function public.discover_people(integer, integer, integer, text) from public, anon;
grant execute on function public.discover_people(integer, integer, integer, text) to authenticated;
commit;
