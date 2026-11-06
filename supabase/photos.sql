-- Seven fixed object names per account enforce a maximum of seven photos.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Own profile photos" on storage.objects;
create policy "Own profile photos" on storage.objects
for all to authenticated
using (
  bucket_id = 'profile-photos'
  and name ~ ('^' || (select auth.uid())::text || '/[1-7]$')
)
with check (
  bucket_id = 'profile-photos'
  and name ~ ('^' || (select auth.uid())::text || '/[1-7]$')
);
commit;
