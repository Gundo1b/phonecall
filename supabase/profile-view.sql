-- Run after account-setup.sql and photos.sql.
begin;
create or replace function public.profile_is_visible(account_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.users u
    join public.account_setup s on s.user_id = u.auth_user_id
    join auth.users a on a.id = u.auth_user_id
    where a.id = account_id and a.email is not null and a.email <> ''
      and a.email_confirmed_at is not null
      and a.encrypted_password is not null and a.encrypted_password <> ''
  );
$$;
revoke all on function public.profile_is_visible(uuid) from public, anon;
grant execute on function public.profile_is_visible(uuid) to authenticated;

create or replace function public.view_dating_profile(target_profile uuid)
returns table (display_name text, gender text, age integer, photo_paths text[])
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(trim(u.name), ''), 'Member'), s.gender,
    extract(year from age(current_date, d.birth_date))::integer,
    array(select o.name from storage.objects o
      where o.bucket_id = 'profile-photos'
        and o.name ~ ('^' || u.auth_user_id::text || '/[1-7]$')
      order by o.name)
  from public.users u
  join public.account_setup s on s.user_id = u.auth_user_id
  left join public.signup_details d on d.user_id = u.auth_user_id
  where u.id = target_profile and public.profile_is_visible(u.auth_user_id);
$$;
revoke all on function public.view_dating_profile(uuid) from public, anon;
grant execute on function public.view_dating_profile(uuid) to authenticated;

drop policy if exists "Read completed profile photos" on storage.objects;
create policy "Read completed profile photos" on storage.objects
for select to authenticated using (
  bucket_id = 'profile-photos'
  and case when name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[1-7]$'
    then public.profile_is_visible(((storage.foldername(name))[1])::uuid)
    else false end
);
commit;
