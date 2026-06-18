-- TripWall email/password auth support.
-- Keeps anonymous ownership as a fallback while allowing new content to bind to Supabase Auth users.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '旅人'
    check (char_length(display_name) between 1 and 30),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profile_updated_at on public.profiles;
create trigger set_profile_updated_at
before update on public.profiles
for each row
execute function public.set_profile_updated_at();

alter table public.questions
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.answers
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.itineraries
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists questions_user_id_idx
  on public.questions (user_id);

create index if not exists answers_user_id_idx
  on public.answers (user_id);

create index if not exists itineraries_user_id_idx
  on public.itineraries (user_id);

drop policy if exists "anyone can insert questions" on public.questions;
create policy "anyone can insert questions"
  on public.questions for insert
  with check (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "anyone can insert answers" on public.answers;
create policy "anyone can insert answers"
  on public.answers for insert
  with check (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "anyone can insert itineraries" on public.itineraries;
create policy "anyone can insert itineraries"
  on public.itineraries for insert
  with check (
    is_public = true
    and (user_id is null or (select auth.uid()) = user_id)
  );

create or replace function public.update_trip_post(
  qid uuid,
  anon text,
  next_title text,
  next_location text,
  next_country text,
  next_category text,
  next_budget_level text,
  next_budget_amount integer,
  next_season text,
  next_tags text[],
  next_image_url text,
  next_content text
)
returns public.questions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_budget integer;
  updated_row public.questions;
begin
  normalized_budget := greatest(0, least(coalesce(next_budget_amount, 15000), 50000));

  update public.questions
     set title = trim(next_title),
         location = trim(next_location),
         country = trim(next_country),
         category = next_category,
         budget_amount = normalized_budget,
         budget_level = case
           when normalized_budget <= 8000 then 'low'
           when normalized_budget <= 25000 then 'mid'
           else 'high'
         end,
         season = next_season,
         tags = coalesce(next_tags, '{}'),
         image_url = nullif(trim(coalesce(next_image_url, '')), ''),
         content = trim(next_content),
         wall_type = 'travel'
   where id = qid
     and (
       author_anon_id = anon
       or (user_id is not null and user_id = (select auth.uid()))
     )
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Trip post not found or edit permission denied.';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.update_trip_post(
  uuid, text, text, text, text, text, text, integer, text, text[], text, text
) from public;
grant execute on function public.update_trip_post(
  uuid, text, text, text, text, text, text, integer, text, text[], text, text
) to anon, authenticated;

create or replace function public.delete_trip_post(
  qid uuid,
  anon text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_id uuid;
begin
  delete from public.questions
   where id = qid
     and (
       author_anon_id = anon
       or (user_id is not null and user_id = (select auth.uid()))
     )
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Trip post not found or delete permission denied.';
  end if;

  return deleted_id;
end;
$$;

revoke all on function public.delete_trip_post(uuid, text) from public;
grant execute on function public.delete_trip_post(uuid, text) to anon, authenticated;

create or replace function public.update_answer(
  answer_id uuid,
  anon text,
  next_author_name text,
  next_content text
)
returns public.answers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_row public.answers;
begin
  update public.answers
     set author_name = left(nullif(trim(coalesce(next_author_name, '')), ''), 30),
         content = trim(next_content)
   where id = answer_id
     and (
       author_anon_id = anon
       or (user_id is not null and user_id = (select auth.uid()))
     )
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'Comment not found or edit permission denied.';
  end if;

  return updated_row;
end;
$$;

revoke all on function public.update_answer(uuid, text, text, text) from public;
grant execute on function public.update_answer(uuid, text, text, text) to anon, authenticated;

create or replace function public.delete_answer(
  answer_id uuid,
  anon text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_id uuid;
begin
  delete from public.answers
   where id = answer_id
     and (
       author_anon_id = anon
       or (user_id is not null and user_id = (select auth.uid()))
     )
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Comment not found or delete permission denied.';
  end if;

  return deleted_id;
end;
$$;

revoke all on function public.delete_answer(uuid, text) from public;
grant execute on function public.delete_answer(uuid, text) to anon, authenticated;

create or replace function public.delete_itinerary(
  itinerary_id uuid,
  anon text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_id uuid;
begin
  delete from public.itineraries
   where id = itinerary_id
     and (
       author_anon_id = anon
       or (user_id is not null and user_id = (select auth.uid()))
     )
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Itinerary not found or delete permission denied.';
  end if;

  return deleted_id;
end;
$$;

revoke all on function public.delete_itinerary(uuid, text) from public;
grant execute on function public.delete_itinerary(uuid, text) to anon, authenticated;
