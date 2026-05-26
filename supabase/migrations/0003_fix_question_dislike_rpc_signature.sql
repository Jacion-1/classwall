-- Ensure the dislike RPC exists with both argument orders.
-- This migration is idempotent and fixes schema cache issues in Supabase clients.

create or replace function public.increment_question_dislike(
  anon text,
  qid uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result integer;
begin
  insert into public.question_dislikes (question_id, anon_id)
  values (qid, anon)
  on conflict do nothing;

  if found then
    update public.questions
       set dislikes = dislikes + 1
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

revoke all on function public.increment_question_dislike(text, uuid) from public;
grant execute on function public.increment_question_dislike(text, uuid) to anon, authenticated;

comment on function public.increment_question_dislike(text, uuid) is
  'Atomically insert dedup row + increment questions.dislikes. Anon-callable via supabase.rpc() with anon parameter first.';

create or replace function public.increment_question_dislike(
  qid uuid,
  anon text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.increment_question_dislike(anon, qid);
end;
$$;

revoke all on function public.increment_question_dislike(uuid, text) from public;
grant execute on function public.increment_question_dislike(uuid, text) to anon, authenticated;

comment on function public.increment_question_dislike(uuid, text) is
  'Alias overload to support either RPC argument order.';
