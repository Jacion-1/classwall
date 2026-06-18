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
  deleted_count integer;
  new_likes integer;
begin
  delete from public.question_likes
   where question_id = qid
     and anon_id = anon;

  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
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
  'Atomically remove a want-to-go row and decrement questions.likes if present.';
