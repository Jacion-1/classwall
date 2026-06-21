-- Keep legacy update_trip_post overloads aligned with the stricter ownership rule.

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
     and (
       (user_id is not null and user_id = (select auth.uid()))
       or (user_id is null and author_anon_id = anon)
     )
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
     and (
       (user_id is not null and user_id = (select auth.uid()))
       or (user_id is null and author_anon_id = anon)
     )
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
