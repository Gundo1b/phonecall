-- Run after contact-signup.sql and photos.sql.
begin;
create table if not exists public.account_setup (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender text not null check (gender in ('woman', 'man', 'nonbinary', 'self_described', 'prefer_not_to_say')),
  completed_at timestamptz not null default now()
);
alter table public.account_setup enable row level security;
revoke all on public.account_setup from anon, authenticated;

create or replace function public.registration_status()
returns table (contact_number text, completed boolean)
language sql stable security definer set search_path = '' as $$
  select u.phone_number,
    exists(select 1 from public.account_setup s where s.user_id = auth.uid())
    and a.encrypted_password is not null and a.encrypted_password <> ''
    and a.email is not null and a.email <> '' and a.email_confirmed_at is not null
  from public.users u join auth.users a on a.id = u.auth_user_id
  where u.auth_user_id = auth.uid();
$$;

create or replace function public.finish_account_setup(selected_gender text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from auth.users a join public.users u on u.auth_user_id = a.id
    where a.id = auth.uid() and a.encrypted_password is not null
      and a.encrypted_password <> '' and a.email is not null and a.email <> '' and a.email_confirmed_at is not null

  ) then raise exception 'Set your email and password first. Confirm your email or disable email confirmation in Supabase.';
  end if;
  insert into public.account_setup(user_id, gender) values (auth.uid(), selected_gender)
  on conflict (user_id) do update set gender = excluded.gender;
end;
$$;
revoke all on function public.registration_status() from public, anon;
revoke all on function public.finish_account_setup(text) from public, anon;
grant execute on function public.registration_status() to authenticated;
grant execute on function public.finish_account_setup(text) to authenticated;

-- Restrictive policy combines with the existing owner policy.
create or replace function public.photo_setup_complete()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.registration_status() where completed);
$$;
revoke all on function public.photo_setup_complete() from public, anon;
grant execute on function public.photo_setup_complete() to authenticated;
drop policy if exists "Setup required before photos" on storage.objects;
create policy "Setup required before photos" on storage.objects as restrictive
for insert to authenticated with check (
  bucket_id <> 'profile-photos' or (select public.photo_setup_complete())
);
commit;

