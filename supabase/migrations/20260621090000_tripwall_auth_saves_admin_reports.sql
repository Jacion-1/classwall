-- Tighten TripWall ownership, account-bound saves, and admin report queue.

-- Upgrade trip_saves from anonymous-only composite key to account-aware rows.
alter table public.trip_saves
  add column if not exists id uuid;

update public.trip_saves
   set id = gen_random_uuid()
 where id is null;

alter table public.trip_saves
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.trip_saves
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.trip_saves
  drop constraint if exists trip_saves_pkey;

alter table public.trip_saves
  alter column anon_id drop not null;

alter table public.trip_saves
  add constraint trip_saves_pkey primary key (id);

create index if not exists trip_saves_user_id_idx
  on public.trip_saves (user_id);

create index if not exists trip_saves_anon_id_idx
  on public.trip_saves (anon_id)
  where user_id is null and anon_id is not null;

create unique index if not exists trip_saves_question_user_unique
  on public.trip_saves (question_id, user_id)
  where user_id is not null;

create unique index if not exists trip_saves_question_anon_unique
  on public.trip_saves (question_id, anon_id)
  where user_id is null and anon_id is not null;

alter table public.trip_saves enable row level security;

grant select on public.trip_saves to authenticated;

drop policy if exists "users can read own trip saves" on public.trip_saves;
create policy "users can read own trip saves"
on public.trip_saves
for select
using (user_id is not null and user_id = (select auth.uid()));

create or replace function public.is_trip_saved(
  qid uuid,
  anon text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is not null then
    return exists (
      select 1
      from public.trip_saves
      where question_id = qid
        and user_id = current_user_id
    );
  end if;

  return exists (
    select 1
    from public.trip_saves
    where question_id = qid
      and user_id is null
      and anon_id = anon
  );
end;
$$;

revoke all on function public.is_trip_saved(uuid, text) from public;
grant execute on function public.is_trip_saved(uuid, text) to anon, authenticated;

create or replace function public.saved_trip_ids(
  anon text default null
)
returns uuid[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  ids uuid[];
begin
  if current_user_id is not null then
    select coalesce(array_agg(question_id order by created_at desc), '{}')
      into ids
      from public.trip_saves
     where user_id = current_user_id;
  else
    select coalesce(array_agg(question_id order by created_at desc), '{}')
      into ids
      from public.trip_saves
     where user_id is null
       and anon_id = anon;
  end if;

  return ids;
end;
$$;

revoke all on function public.saved_trip_ids(text) from public;
grant execute on function public.saved_trip_ids(text) to anon, authenticated;

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
  current_user_id uuid := (select auth.uid());
  inserted_id uuid;
  new_saves integer;
begin
  if current_user_id is not null then
    insert into public.trip_saves (question_id, user_id)
    values (qid, current_user_id)
    on conflict (question_id, user_id) where user_id is not null do nothing
    returning id into inserted_id;
  else
    insert into public.trip_saves (question_id, anon_id)
    values (qid, anon)
    on conflict (question_id, anon_id) where user_id is null and anon_id is not null do nothing
    returning id into inserted_id;
  end if;

  if inserted_id is not null then
    update public.questions
       set saves = (
         select count(*)::integer
           from public.trip_saves
          where question_id = qid
       )
     where id = qid
    returning saves into new_saves;
  else
    select saves into new_saves
      from public.questions
     where id = qid;
  end if;

  return coalesce(new_saves, 0);
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
  current_user_id uuid := (select auth.uid());
  deleted_count integer;
  new_saves integer;
begin
  if current_user_id is not null then
    delete from public.trip_saves
     where question_id = qid
       and user_id = current_user_id;
  else
    delete from public.trip_saves
     where question_id = qid
       and user_id is null
       and anon_id = anon;
  end if;

  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    update public.questions
       set saves = (
         select count(*)::integer
           from public.trip_saves
          where question_id = qid
       )
     where id = qid
    returning saves into new_saves;
  else
    select saves into new_saves
      from public.questions
     where id = qid;
  end if;

  return coalesce(new_saves, 0);
end;
$$;

revoke all on function public.decrement_trip_save(uuid, text) from public;
grant execute on function public.decrement_trip_save(uuid, text) to anon, authenticated;

drop function if exists public.claim_tripwall_items(text);
create function public.claim_tripwall_items(anon text)
returns table(
  questions_claimed integer,
  answers_claimed integer,
  itineraries_claimed integer,
  saves_claimed integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Login required to claim TripWall items.';
  end if;

  update public.questions
     set user_id = current_user_id
   where author_anon_id = anon
     and user_id is null;
  get diagnostics questions_claimed = row_count;

  update public.answers
     set user_id = current_user_id
   where author_anon_id = anon
     and user_id is null;
  get diagnostics answers_claimed = row_count;

  update public.itineraries
     set user_id = current_user_id
   where author_anon_id = anon
     and user_id is null;
  get diagnostics itineraries_claimed = row_count;

  create temporary table if not exists pg_temp.tripwall_claimed_save_questions (
    question_id uuid primary key
  ) on commit drop;
  truncate pg_temp.tripwall_claimed_save_questions;

  insert into pg_temp.tripwall_claimed_save_questions (question_id)
  select distinct question_id
    from public.trip_saves
   where user_id is null
     and anon_id = anon;

  insert into public.trip_saves (question_id, user_id, created_at)
  select question_id, current_user_id, now()
    from pg_temp.tripwall_claimed_save_questions
  on conflict (question_id, user_id) where user_id is not null do nothing;

  delete from public.trip_saves
   where user_id is null
     and anon_id = anon
     and question_id in (
       select question_id from pg_temp.tripwall_claimed_save_questions
     );

  get diagnostics saves_claimed = row_count;

  update public.questions q
     set saves = (
       select count(*)::integer
         from public.trip_saves s
        where s.question_id = q.id
     )
   where q.id in (
     select question_id from pg_temp.tripwall_claimed_save_questions
   );

  return next;
end;
$$;

revoke all on function public.claim_tripwall_items(text) from public;
grant execute on function public.claim_tripwall_items(text) to authenticated;

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
  normalized_image_url text;
  updated_row public.questions;
begin
  normalized_budget := greatest(0, least(coalesce(next_budget_amount, 15000), 50000));
  normalized_image_url := nullif(trim(coalesce(next_image_url, '')), '');

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
         image_url = normalized_image_url,
         image_urls = case
           when normalized_image_url is null then '{}'
           else array[normalized_image_url]
         end,
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
       (user_id is not null and user_id = (select auth.uid()))
       or (user_id is null and author_anon_id = anon)
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
     set author_name = coalesce(left(nullif(trim(coalesce(next_author_name, '')), ''), 30), '匿名旅人'),
         content = trim(next_content)
   where id = answer_id
     and (
       (user_id is not null and user_id = (select auth.uid()))
       or (user_id is null and author_anon_id = anon)
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
       (user_id is not null and user_id = (select auth.uid()))
       or (user_id is null and author_anon_id = anon)
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
       (user_id is not null and user_id = (select auth.uid()))
       or (user_id is null and author_anon_id = anon)
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
       (user_id is not null and user_id = (select auth.uid()))
       or (user_id is null and author_anon_id = anon)
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

create or replace function public.admin_report_queue()
returns table(
  report_id uuid,
  target_type text,
  target_id uuid,
  reason text,
  detail text,
  status text,
  admin_note text,
  created_at timestamptz,
  updated_at timestamptz,
  reporter_anon_id text,
  target_exists boolean,
  target_title text,
  target_preview text,
  target_location text,
  target_author_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_tripwall_admin() then
    raise exception 'Only admins can read reports.';
  end if;

  return query
  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.detail,
    r.status,
    r.admin_note,
    r.created_at,
    r.updated_at,
    r.reporter_anon_id,
    q.id is not null,
    q.title,
    left(q.content, 260),
    concat_ws(' / ', nullif(q.country, ''), nullif(q.location, '')),
    coalesce(p.display_name, '匿名旅人')
  from public.content_reports r
  left join public.questions q
    on r.target_type = 'question'
   and q.id = r.target_id
  left join public.profiles p
    on p.id = q.user_id
  where r.target_type = 'question'

  union all

  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.detail,
    r.status,
    r.admin_note,
    r.created_at,
    r.updated_at,
    r.reporter_anon_id,
    a.id is not null,
    coalesce('留言：' || q.title, '留言'),
    left(a.content, 260),
    concat_ws(' / ', nullif(q.country, ''), nullif(q.location, '')),
    coalesce(a.author_name, p.display_name, '匿名旅人')
  from public.content_reports r
  left join public.answers a
    on r.target_type = 'answer'
   and a.id = r.target_id
  left join public.questions q
    on q.id = a.question_id
  left join public.profiles p
    on p.id = a.user_id
  where r.target_type = 'answer'

  union all

  select
    r.id,
    r.target_type,
    r.target_id,
    r.reason,
    r.detail,
    r.status,
    r.admin_note,
    r.created_at,
    r.updated_at,
    r.reporter_anon_id,
    i.id is not null,
    i.title,
    left(coalesce(nullif(i.notes, ''), i.trip_style, ''), 260),
    concat_ws(' / ', nullif(i.country, ''), nullif(i.city, '')),
    coalesce(i.author_name, p.display_name, '匿名旅人')
  from public.content_reports r
  left join public.itineraries i
    on r.target_type = 'itinerary'
   and i.id = r.target_id
  left join public.profiles p
    on p.id = i.user_id
  where r.target_type = 'itinerary'
  order by created_at desc
  limit 100;
end;
$$;

revoke all on function public.admin_report_queue() from public;
grant execute on function public.admin_report_queue() to authenticated;
