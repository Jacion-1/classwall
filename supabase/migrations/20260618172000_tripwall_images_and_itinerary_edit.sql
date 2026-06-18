-- TripWall image storage and editable itinerary details.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'trip-images',
  'trip-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "trip images are publicly readable" on storage.objects;
create policy "trip images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'trip-images');

drop policy if exists "users can upload own trip images" on storage.objects;
create policy "users can upload own trip images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trip-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users can update own trip images" on storage.objects;
create policy "users can update own trip images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'trip-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'trip-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "users can delete own trip images" on storage.objects;
create policy "users can delete own trip images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trip-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.update_itinerary(
  itinerary_id uuid,
  anon text,
  next_title text,
  next_country text,
  next_city text,
  next_author_name text,
  next_trip_days integer,
  next_budget_amount integer,
  next_trip_style text,
  next_tags text[],
  next_days jsonb,
  next_notes text
)
returns public.itineraries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_row public.itineraries;
begin
  update public.itineraries
     set title = left(trim(next_title), 90),
         country = left(trim(next_country), 80),
         city = left(trim(next_city), 80),
         author_name = coalesce(left(nullif(trim(next_author_name), ''), 30), '匿名旅人'),
         trip_days = greatest(1, least(coalesce(next_trip_days, 1), 30)),
         budget_amount = greatest(0, least(coalesce(next_budget_amount, 15000), 50000)),
         trip_style = left(coalesce(nullif(trim(next_trip_style), ''), '自由行'), 30),
         tags = coalesce(next_tags, '{}'),
         days = coalesce(next_days, '[]'::jsonb),
         notes = left(coalesce(next_notes, ''), 1200)
   where id = itinerary_id
     and (
       author_anon_id = anon
       or (user_id is not null and user_id = (select auth.uid()))
     )
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Itinerary not found or edit permission denied.';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.update_itinerary(
  uuid, text, text, text, text, text, integer, integer, text, text[], jsonb, text
) from public;
grant execute on function public.update_itinerary(
  uuid, text, text, text, text, text, integer, integer, text, text[], jsonb, text
) to anon, authenticated;
