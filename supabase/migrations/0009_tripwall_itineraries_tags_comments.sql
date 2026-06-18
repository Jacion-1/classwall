-- TripWall itineraries, lifestyle tags, and editable comments.

alter table public.questions
  add column if not exists tags text[] not null default '{}';

alter table public.answers
  add column if not exists author_anon_id text,
  add column if not exists author_name text not null default '旅人',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists questions_tags_idx
  on public.questions using gin (tags);

create index if not exists answers_author_anon_id_idx
  on public.answers (author_anon_id);

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
     and author_anon_id = anon
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

create or replace function public.set_answer_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_answer_updated_at on public.answers;
create trigger set_answer_updated_at
before update on public.answers
for each row
execute function public.set_answer_updated_at();

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
     and author_anon_id = anon
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
     and author_anon_id = anon
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Comment not found or delete permission denied.';
  end if;

  return deleted_id;
end;
$$;

revoke all on function public.delete_answer(uuid, text) from public;
grant execute on function public.delete_answer(uuid, text) to anon, authenticated;

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 90),
  country text not null check (char_length(country) between 1 and 80),
  city text not null check (char_length(city) between 1 and 80),
  trip_days integer not null default 3 check (trip_days between 1 and 30),
  budget_amount integer not null default 15000 check (budget_amount between 0 and 50000),
  trip_style text not null default '自由行',
  tags text[] not null default '{}',
  days jsonb not null default '[]'::jsonb,
  notes text not null default '' check (char_length(notes) <= 1200),
  author_anon_id text,
  author_name text not null default '旅人',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists itineraries_public_created_idx
  on public.itineraries (is_public, created_at desc);

create index if not exists itineraries_country_idx
  on public.itineraries (country, city);

create index if not exists itineraries_author_anon_id_idx
  on public.itineraries (author_anon_id);

create index if not exists itineraries_tags_idx
  on public.itineraries using gin (tags);

alter table public.itineraries enable row level security;

drop policy if exists "anyone can read public itineraries" on public.itineraries;
create policy "anyone can read public itineraries"
  on public.itineraries for select
  using (is_public = true);

drop policy if exists "anyone can insert itineraries" on public.itineraries;
create policy "anyone can insert itineraries"
  on public.itineraries for insert
  with check (is_public = true);

create or replace function public.set_itinerary_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_itinerary_updated_at on public.itineraries;
create trigger set_itinerary_updated_at
before update on public.itineraries
for each row
execute function public.set_itinerary_updated_at();

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
     and author_anon_id = anon
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Itinerary not found or delete permission denied.';
  end if;

  return deleted_id;
end;
$$;

revoke all on function public.delete_itinerary(uuid, text) from public;
grant execute on function public.delete_itinerary(uuid, text) to anon, authenticated;
