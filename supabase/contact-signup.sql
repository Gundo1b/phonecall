-- Run once in Supabase SQL Editor. Existing users/calls are preserved.
begin;
alter table public.users add column if not exists auth_user_id uuid references auth.users(id);
create unique index if not exists users_auth_user_id_unique on public.users(auth_user_id);

-- Keep birth dates separate from the existing public contacts table.
create table if not exists public.signup_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null check (birth_date <= (current_date - interval '18 years')::date)
);
alter table public.signup_details enable row level security;
revoke all on public.signup_details from anon, authenticated;

create or replace function public.complete_contact_signup(display_name text, birth_date date, contact_number text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_phone text;
  profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Please start signup again.';
  end if;
  if contact_number is null or contact_number !~ '^\+27[6-8][0-9]{8}$' then
    raise exception 'Enter a valid South African contact number.';
  end if;
  verified_phone := contact_number;
  if birth_date is null or birth_date > (current_date - interval '18 years')::date
     or birth_date < (current_date - interval '120 years')::date then
    raise exception 'Enter a valid date of birth. You must be 18 or older.';
  end if;
  if display_name is null or length(trim(display_name)) not between 2 and 100 then
    raise exception 'Enter a name between 2 and 100 characters.';
  end if;

  insert into public.signup_details(user_id, birth_date)
  values (auth.uid(), birth_date)
  on conflict (user_id) do nothing;

  -- Contact numbers do not prove ownership. Never claim another profile.
  insert into public.users(id, phone_number, name, auth_user_id)
  values (auth.uid(), verified_phone, trim(display_name), auth.uid())
  on conflict (phone_number) do update
    set name = excluded.name, auth_user_id = excluded.auth_user_id
    where public.users.auth_user_id = auth.uid()
  returning id into profile_id;
  if profile_id is null then
    raise exception 'This number is already registered. Contact support to recover your profile.';
  end if;
  return profile_id;
end;
$$;
revoke all on function public.complete_contact_signup(text, date, text) from public, anon;
grant execute on function public.complete_contact_signup(text, date, text) to authenticated;

-- Registration now goes through the verified signup function.
revoke insert, update on public.users from anon;
-- Preserve the current contacts screen for signed-in accounts.
grant select on public.users to authenticated;
alter table public.users enable row level security;
drop policy if exists "Signed in accounts read contacts" on public.users;
create policy "Signed in accounts read contacts" on public.users
for select to authenticated using (true);
commit;

