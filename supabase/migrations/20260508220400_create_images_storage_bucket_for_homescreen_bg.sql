insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "Public read for images" on storage.objects;
drop policy if exists "Authenticated users can upload homescreen images" on storage.objects;
drop policy if exists "Users can update their own homescreen images" on storage.objects;
drop policy if exists "Users can delete their own homescreen images" on storage.objects;

create policy "Public read for images"
on storage.objects
for select
to public
using (bucket_id = 'images');

create policy "Authenticated users can upload homescreen images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = 'homescreen'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Users can update their own homescreen images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = 'homescreen'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = 'homescreen'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Users can delete their own homescreen images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'images'
  and (storage.foldername(name))[1] = 'homescreen'
  and (storage.foldername(name))[2] = auth.uid()::text
);
