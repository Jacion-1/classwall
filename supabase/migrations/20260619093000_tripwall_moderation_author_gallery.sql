-- TripWall moderation, public author pages, and multi-image posts.

alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin'));

update public.profiles
set role = 'admin'
where email = 'c113118244@nkust.edu.tw';

alter table public.questions
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null,
  add column if not exists hidden_reason text;

update public.questions
set image_urls = case
  when image_url is not null and trim(image_url) <> '' then array[image_url]
  else '{}'
end
where image_urls = '{}';

alter table public.answers
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null,
  add column if not exists hidden_reason text;

alter table public.itineraries
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null,
  add column if not exists hidden_reason text;

create index if not exists questions_visible_created_idx
  on public.questions (wall_type, is_hidden, created_at desc);

create index if not exists answers_visible_question_idx
  on public.answers (question_id, is_hidden, created_at);

create index if not exists itineraries_visible_created_idx
  on public.itineraries (is_public, is_hidden, created_at desc);

create index if not exists profiles_role_idx
  on public.profiles (role);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('question', 'answer', 'itinerary')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 60),
  detail text not null default '' check (char_length(detail) <= 500),
  reporter_anon_id text,
  reporter_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note text not null default '' check (char_length(admin_note) <= 500),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_reports enable row level security;

grant select, insert, update on public.content_reports to anon, authenticated;

create or replace function public.is_tripwall_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_tripwall_admin() from public;
grant execute on function public.is_tripwall_admin() to anon, authenticated;

create or replace function public.set_content_report_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_content_report_updated_at on public.content_reports;
create trigger set_content_report_updated_at
before update on public.content_reports
for each row execute function public.set_content_report_updated_at();

drop policy if exists "anyone can read questions" on public.questions;
create policy "visible questions can be read"
on public.questions
for select
using (
  is_hidden = false
  or (user_id is not null and user_id = (select auth.uid()))
  or public.is_tripwall_admin()
);

drop policy if exists "anyone can read answers" on public.answers;
create policy "visible answers can be read"
on public.answers
for select
using (
  is_hidden = false
  or (user_id is not null and user_id = (select auth.uid()))
  or public.is_tripwall_admin()
);

drop policy if exists "anyone can read public itineraries" on public.itineraries;
create policy "visible public itineraries can be read"
on public.itineraries
for select
using (
  (is_public = true and is_hidden = false)
  or (user_id is not null and user_id = (select auth.uid()))
  or public.is_tripwall_admin()
);

drop policy if exists "anyone can report content" on public.content_reports;
create policy "anyone can report content"
on public.content_reports
for insert
with check (
  status = 'open'
  and (
    reporter_user_id is null
    or reporter_user_id = (select auth.uid())
  )
);

drop policy if exists "admins can read reports" on public.content_reports;
create policy "admins can read reports"
on public.content_reports
for select
using (public.is_tripwall_admin());

drop policy if exists "admins can update reports" on public.content_reports;
create policy "admins can update reports"
on public.content_reports
for update
using (public.is_tripwall_admin())
with check (public.is_tripwall_admin());

create or replace function public.submit_content_report(
  target_type text,
  target_id uuid,
  reason text,
  detail text default '',
  reporter_anon_id text default null
)
returns public.content_reports
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
<<report_args>>
declare
  created_report public.content_reports;
begin
  insert into public.content_reports (
    target_type,
    target_id,
    reason,
    detail,
    reporter_anon_id,
    reporter_user_id
  )
  values (
    report_args.target_type,
    report_args.target_id,
    report_args.reason,
    coalesce(report_args.detail, ''),
    report_args.reporter_anon_id,
    (select auth.uid())
  )
  returning * into created_report;

  return created_report;
end;
$$;

grant execute on function public.submit_content_report(text, uuid, text, text, text) to anon, authenticated;

create or replace function public.moderate_content(
  report_id uuid,
  next_status text,
  action text,
  note text default ''
)
returns public.content_reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_report public.content_reports;
  updated_report public.content_reports;
  admin_id uuid := (select auth.uid());
  hide_content boolean;
begin
  if not public.is_tripwall_admin() then
    raise exception 'Only admins can moderate content.';
  end if;

  if next_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'Invalid report status.';
  end if;

  if action not in ('none', 'hide', 'restore') then
    raise exception 'Invalid moderation action.';
  end if;

  select *
  into target_report
  from public.content_reports
  where id = report_id;

  if target_report.id is null then
    raise exception 'Report not found.';
  end if;

  hide_content := action = 'hide';

  if action in ('hide', 'restore') then
    if target_report.target_type = 'question' then
      update public.questions
      set
        is_hidden = hide_content,
        hidden_at = case when hide_content then now() else null end,
        hidden_by = case when hide_content then admin_id else null end,
        hidden_reason = case when hide_content then coalesce(note, '') else null end
      where id = target_report.target_id;
    elsif target_report.target_type = 'answer' then
      update public.answers
      set
        is_hidden = hide_content,
        hidden_at = case when hide_content then now() else null end,
        hidden_by = case when hide_content then admin_id else null end,
        hidden_reason = case when hide_content then coalesce(note, '') else null end
      where id = target_report.target_id;
    elsif target_report.target_type = 'itinerary' then
      update public.itineraries
      set
        is_hidden = hide_content,
        hidden_at = case when hide_content then now() else null end,
        hidden_by = case when hide_content then admin_id else null end,
        hidden_reason = case when hide_content then coalesce(note, '') else null end
      where id = target_report.target_id;
    end if;
  end if;

  update public.content_reports
  set
    status = next_status,
    admin_note = coalesce(note, ''),
    resolved_by = case when next_status in ('resolved', 'dismissed') then admin_id else null end,
    resolved_at = case when next_status in ('resolved', 'dismissed') then now() else null end
  where id = report_id
  returning * into updated_report;

  return updated_report;
end;
$$;

grant execute on function public.moderate_content(uuid, text, text, text) to authenticated;

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
