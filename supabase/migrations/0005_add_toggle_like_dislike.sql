-- Add decrement RPCs for undoing likes and dislikes
-- Idempotent migration

create or replace function public.decrement_question_like(
  qid uuid,
  anon text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_likes integer;
begin
  delete from public.question_likes
  where question_id = qid
    and anon_id = anon;

  if found then
    update public.questions
       set likes = greatest(likes - 1, 0)
     where id = qid
    returning likes into new_likes;
  else
    select likes into new_likes
      from public.questions
     where id = qid;
  end if;

  return new_likes;
end;
$$;

revoke all on function public.decrement_question_like(uuid, text) from public;
grant execute on function public.decrement_question_like(uuid, text) to anon, authenticated;

comment on function public.decrement_question_like(uuid, text) is
  'Atomically remove like row and decrement questions.likes if present.';

create or replace function public.decrement_question_dislike(
  qid uuid,
  anon text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_dislikes integer;
begin
  delete from public.question_dislikes
  where question_id = qid
    and anon_id = anon;

  if found then
    update public.questions
       set dislikes = greatest(dislikes - 1, 0)
     where id = qid
    returning dislikes into new_dislikes;
  else
    select dislikes into new_dislikes
      from public.questions
     where id = qid;
  end if;

  return new_dislikes;
end;
$$;

revoke all on function public.decrement_question_dislike(uuid, text) from public;
grant execute on function public.decrement_question_dislike(uuid, text) to anon, authenticated;

comment on function public.decrement_question_dislike(uuid, text) is
  'Atomically remove dislike row and decrement questions.dislikes if present.';
