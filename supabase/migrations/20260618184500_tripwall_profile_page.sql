-- TripWall profile page support.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text not null default ''
    check (char_length(bio) <= 240);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-images',
  'profile-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile images are publicly readable" on storage.objects;
create policy "profile images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-images');

drop policy if exists "users can upload own profile images" on storage.objects;
create policy "users can upload own profile images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users can update own profile images" on storage.objects;
create policy "users can update own profile images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users can delete own profile images" on storage.objects;
create policy "users can delete own profile images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
