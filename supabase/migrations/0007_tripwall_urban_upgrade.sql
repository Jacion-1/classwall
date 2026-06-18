-- TripWall urban upgrade: clean the old wall data and support anonymous editing.

truncate table
  public.answers,
  public.question_likes,
  public.question_dislikes,
  public.trip_saves,
  public.questions
restart identity cascade;

alter table public.questions
  add column if not exists author_anon_id text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists wall_type text not null default 'travel';

alter table public.questions
  drop constraint if exists questions_content_check,
  add constraint questions_content_check check (char_length(content) between 1 and 1200);

alter table public.questions
  drop constraint if exists questions_wall_type_check,
  add constraint questions_wall_type_check check (wall_type in ('travel'));

create index if not exists questions_author_anon_id_idx
  on public.questions (author_anon_id);

create index if not exists questions_wall_type_created_idx
  on public.questions (wall_type, created_at desc);

create or replace function public.set_trip_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trip_updated_at on public.questions;
create trigger set_trip_updated_at
before update on public.questions
for each row
execute function public.set_trip_updated_at();

create or replace function public.update_trip_post(
  qid uuid,
  anon text,
  next_title text,
  next_location text,
  next_country text,
  next_category text,
  next_budget_level text,
  next_season text,
  next_image_url text,
  next_content text
)
returns public.questions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_row public.questions;
begin
  update public.questions
     set title = trim(next_title),
         location = trim(next_location),
         country = trim(next_country),
         category = next_category,
         budget_level = next_budget_level,
         season = next_season,
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
  uuid, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.update_trip_post(
  uuid, text, text, text, text, text, text, text, text, text
) to anon, authenticated;
