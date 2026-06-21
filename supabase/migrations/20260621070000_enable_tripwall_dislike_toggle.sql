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
  deleted_count integer;
  new_dislikes integer;
begin
  delete from public.question_dislikes
  where question_id = qid
    and anon_id = anon;

  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    update public.questions
    set dislikes = greatest(dislikes - 1, 0)
    where id = qid
    returning dislikes into new_dislikes;
  else
    select dislikes into new_dislikes
    from public.questions
    where id = qid;
  end if;

  return coalesce(new_dislikes, 0);
end;
$$;

revoke all on function public.decrement_question_dislike(uuid, text) from public;
grant execute on function public.decrement_question_dislike(uuid, text)
to anon, authenticated;
