-- TripWall first version: reuse the existing questions feed as travel inspirations.
-- Idempotent so it can be re-run from Supabase SQL Editor or deployed as a migration.

alter table public.questions
  add column if not exists title text not null default 'Untitled trip',
  add column if not exists location text not null default 'Somewhere',
  add column if not exists country text not null default 'Unknown',
  add column if not exists category text not null default 'inspiration',
  add column if not exists budget_level text not null default 'mid',
  add column if not exists season text not null default 'anytime',
  add column if not exists image_url text,
  add column if not exists saves integer not null default 0 check (saves >= 0);

alter table public.questions
  drop constraint if exists questions_title_length,
  add constraint questions_title_length check (char_length(title) between 1 and 80);

alter table public.questions
  drop constraint if exists questions_location_length,
  add constraint questions_location_length check (char_length(location) between 1 and 80);

alter table public.questions
  drop constraint if exists questions_country_length,
  add constraint questions_country_length check (char_length(country) between 1 and 80);

alter table public.questions
  drop constraint if exists questions_category_check,
  add constraint questions_category_check
    check (category in ('spot', 'food', 'stay', 'route', 'transport', 'story', 'inspiration'));

alter table public.questions
  drop constraint if exists questions_budget_level_check,
  add constraint questions_budget_level_check
    check (budget_level in ('low', 'mid', 'high'));

alter table public.questions
  drop constraint if exists questions_season_check,
  add constraint questions_season_check
    check (season in ('spring', 'summer', 'autumn', 'winter', 'anytime'));

create index if not exists questions_trip_filters_idx
  on public.questions (country, category, budget_level, season, created_at desc);

create index if not exists questions_saves_created_idx
  on public.questions (saves desc, created_at desc);

create table if not exists public.trip_saves (
  question_id uuid not null references public.questions (id) on delete cascade,
  anon_id text not null,
  created_at timestamptz not null default now(),
  primary key (question_id, anon_id)
);

create index if not exists trip_saves_question_id_idx
  on public.trip_saves (question_id);

alter table public.trip_saves enable row level security;

create or replace function public.increment_trip_save(
  qid uuid,
  anon text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_saves integer;
begin
  insert into public.trip_saves (question_id, anon_id)
  values (qid, anon)
  on conflict do nothing;

  if found then
    update public.questions
       set saves = saves + 1
     where id = qid
    returning saves into new_saves;
  else
    select saves into new_saves
      from public.questions
     where id = qid;
  end if;

  return new_saves;
end;
$$;

revoke all on function public.increment_trip_save(uuid, text) from public;
grant execute on function public.increment_trip_save(uuid, text) to anon, authenticated;

create or replace function public.decrement_trip_save(
  qid uuid,
  anon text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
  new_saves integer;
begin
  delete from public.trip_saves
   where question_id = qid
     and anon_id = anon;

  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    update public.questions
       set saves = greatest(saves - 1, 0)
     where id = qid
    returning saves into new_saves;
  else
    select saves into new_saves
      from public.questions
     where id = qid;
  end if;

  return new_saves;
end;
$$;

revoke all on function public.decrement_trip_save(uuid, text) from public;
grant execute on function public.decrement_trip_save(uuid, text) to anon, authenticated;

update public.questions
   set title = case
         when title = 'Untitled trip' then left(content, 80)
         else title
       end,
       location = case
         when location = 'Somewhere' then 'Travel inspiration'
         else location
       end,
       country = case
         when country = 'Unknown' then 'Uncategorized'
         else country
       end
 where title = 'Untitled trip'
    or location = 'Somewhere'
    or country = 'Unknown';
