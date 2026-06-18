-- TripWall budget refinement and owner delete support.
-- Keeps the legacy budget_level column for compatibility while adding a numeric budget.

alter table public.questions
  add column if not exists budget_amount integer not null default 15000;

update public.questions
   set budget_amount = case budget_level
         when 'low' then 5000
         when 'high' then 35000
         else 15000
       end
 where budget_amount = 15000;

alter table public.questions
  drop constraint if exists questions_budget_amount_check,
  add constraint questions_budget_amount_check
    check (budget_amount between 0 and 50000);

create index if not exists questions_budget_amount_idx
  on public.questions (wall_type, budget_amount, created_at desc);

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
  uuid, text, text, text, text, text, text, integer, text, text, text
) from public;
grant execute on function public.update_trip_post(
  uuid, text, text, text, text, text, text, integer, text, text, text
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
     and author_anon_id = anon
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Trip post not found or delete permission denied.';
  end if;

  return deleted_id;
end;
$$;

revoke all on function public.delete_trip_post(uuid, text) from public;
grant execute on function public.delete_trip_post(uuid, text) to anon, authenticated;
