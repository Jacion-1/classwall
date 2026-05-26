-- Add JSON-wrapper RPC to reliably accept dislike params regardless of client schema cache
-- Idempotent migration

create or replace function public.increment_question_dislike_json(
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
  new_dislikes integer;
begin
  qid := (payload ->> 'qid')::uuid;
  anon := payload ->> 'anon';

  insert into public.question_dislikes (question_id, anon_id)
  values (qid, anon)
  on conflict do nothing;

  if found then
    update public.questions
       set dislikes = dislikes + 1
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

revoke all on function public.increment_question_dislike_json(json) from public;
grant execute on function public.increment_question_dislike_json(json) to anon, authenticated;

comment on function public.increment_question_dislike_json(json) is
  'Atomically insert dedup row + increment questions.dislikes. Accepts a JSON payload {qid, anon}.';
