-- Add JSON-wrapper RPCs for decrement operations to avoid client schema-cache issues
-- Idempotent migration

create or replace function public.decrement_question_like_json(
  payload json
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  qid uuid;
  anon text;
  result integer;
begin
  qid := (payload ->> 'qid')::uuid;
  anon := payload ->> 'anon';

  delete from public.question_likes
  where question_id = qid
    and anon_id = anon;

  if found then
    update public.questions
       set likes = greatest(likes - 1, 0)
     where id = qid
    returning likes into result;
  else
    select likes into result
      from public.questions
     where id = qid;
  end if;

  return result;
end;
$$;

revoke all on function public.decrement_question_like_json(json) from public;
grant execute on function public.decrement_question_like_json(json) to anon, authenticated;

comment on function public.decrement_question_like_json(json) is
  'JSON wrapper for decrement_question_like, accepts {qid, anon}';

create or replace function public.decrement_question_dislike_json(
  payload json
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  qid uuid;
  anon text;
  result integer;
begin
  qid := (payload ->> 'qid')::uuid;
  anon := payload ->> 'anon';

  delete from public.question_dislikes
  where question_id = qid
    and anon_id = anon;

  if found then
    update public.questions
       set dislikes = greatest(dislikes - 1, 0)
     where id = qid
    returning dislikes into result;
  else
    select dislikes into result
      from public.questions
     where id = qid;
  end if;

  return result;
end;
$$;

revoke all on function public.decrement_question_dislike_json(json) from public;
grant execute on function public.decrement_question_dislike_json(json) to anon, authenticated;

comment on function public.decrement_question_dislike_json(json) is
  'JSON wrapper for decrement_question_dislike, accepts {qid, anon}';
